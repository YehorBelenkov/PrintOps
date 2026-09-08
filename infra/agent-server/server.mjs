#!/usr/bin/env node
// PrintOps agent service. Runs on the VPS beside the NemoClaw sandbox and gives
// the Vercel-hosted app a narrow, authenticated way to reach Igor.
//
// It deliberately does NOT accept shell input. Callers may only send a prompt or
// an image prompt; every command executed here is built locally.
//
//   PORT           listen port (default 8787)
//   AGENT_TOKEN    required bearer token
//   SANDBOX        nemoclaw sandbox name (default igor)
//   DATA_DIR       where generated stickers live (default ./data)

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN = process.env.AGENT_TOKEN ?? '';
const SANDBOX = process.env.SANDBOX ?? 'igor';
const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const INDEX = join(DATA_DIR, 'index.json');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!TOKEN) {
  console.error('AGENT_TOKEN is required.');
  process.exit(1);
}

/** Constant-time compare so the token cannot be guessed byte by byte. */
function tokenMatches(header) {
  const supplied = String(header ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Runs a locally-built script inside the sandbox. Never accepts caller input verbatim. */
async function runInSandbox(innerScript, timeoutSeconds) {
  const script =
    `timeout ${timeoutSeconds} nemoclaw ${SANDBOX} exec -- bash -lc '${innerScript}' 2>&1`;
  try {
    const { stdout } = await execFileAsync('bash', ['-lc', script], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: (timeoutSeconds + 10) * 1000,
    });
    return stdout;
  } catch (error) {
    if (typeof error?.stdout === 'string' && error.stdout.trim()) return error.stdout;
    throw error;
  }
}

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');

// --- fast inference path ---
//
// The OpenClaw CLI costs ~13s of Node startup per call, which dwarfs the request
// itself: NVIDIA answers in ~0.4s. So post straight to NemoClaw's managed route
// from inside the sandbox with curl. The key still lives outside the container and
// egress policy still applies, because the proxy is what injects and enforces both.
//
// Measured on this droplet: 2.9s for an answer, 0.44s for a refusal, against
// 20-26s either way through the CLI.

const PROXY = process.env.SANDBOX_PROXY ?? 'http://10.200.0.1:3128';
const INFERENCE_URL = 'https://inference.local/v1/chat/completions';
const MODEL = process.env.MODEL ?? 'nvidia/nemotron-3-super-120b-a12b';
const FAST_ATTEMPTS = Number(process.env.FAST_ATTEMPTS ?? 4);
const OVERLOADED = /temporarily overloaded|rate.?limit|\b(429|500|502|503|504)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let containerName = '';

/** Cached because the name only changes when the sandbox is recreated. */
async function sandboxContainer() {
  if (containerName) return containerName;
  const { stdout } = await execFileAsync('docker', ['ps', '--format', '{{.Names}}']);
  const found = stdout.split('\n').find((n) => n.includes(`--${SANDBOX}-`));
  if (!found) throw new Error(`No running container for sandbox "${SANDBOX}".`);
  containerName = found.trim();
  return containerName;
}

/** One completion. The prompt goes over stdin, so no shell ever sees it. */
async function completeOnce(prompt, timeoutSeconds) {
  const container = await sandboxContainer();

  const body = JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    temperature: 0.2,
    stream: false,
    // Nemotron emits its reasoning into content unless this is off.
    chat_template_kwargs: { thinking: false },
  });

  const args = [
    'exec', '-i',
    '-e', `https_proxy=${PROXY}`,
    container,
    'curl', '-sk', '-m', String(timeoutSeconds),
    INFERENCE_URL,
    '-H', 'Content-Type: application/json',
    '--data-binary', '@-',
  ];

  const pending = execFileAsync('docker', args, {
    maxBuffer: 10 * 1024 * 1024,
    timeout: (timeoutSeconds + 10) * 1000,
  });
  pending.child.stdin.end(body);

  const { stdout } = await pending;

  try {
    const parsed = JSON.parse(stdout);
    if (parsed.error) return String(parsed.error.message ?? 'inference error');
    return parsed.choices?.[0]?.message?.content ?? '';
  } catch {
    // Unparseable output still needs to reach the caller so it can classify it.
    return stdout;
  }
}

/** Retries here because a refusal costs ~0.4s locally versus a round trip from Vercel. */
async function runAgent(prompt, timeoutSeconds = 180) {
  let last = '';
  for (let attempt = 0; attempt < FAST_ATTEMPTS; attempt++) {
    try {
      last = await completeOnce(prompt, Math.min(timeoutSeconds, 90));
    } catch (error) {
      last = String(error?.stdout || error?.message || error);
    }
    if (last && !OVERLOADED.test(last)) return last;
    await sleep(300 * (attempt + 1));
  }
  return last;
}

async function generateImage(prompt, timeoutSeconds = 200) {
  const id = randomUUID();
  const out = `/tmp/sticker-${id}.png`;
  const promptPath = `/tmp/sticker-${id}.txt`;
  const scriptPath = `/tmp/sticker-${id}.sh`;
  const script =
    `openclaw capability image generate --prompt "$(cat ${promptPath})" ` +
    `--output-format png --background transparent --size 1024x1024 --output ${out} --json`;

  const stdout = await runInSandbox(
    `echo ${b64(prompt)} | base64 -d > ${promptPath}; ` +
      `echo ${b64(script)} | base64 -d > ${scriptPath}; ` +
      `bash ${scriptPath}; echo ---IMAGE---; base64 -w0 ${out} 2>/dev/null; ` +
      `rm -f ${promptPath} ${scriptPath} ${out}`,
    timeoutSeconds
  );

  const [log, payload] = stdout.split('---IMAGE---');
  const data = payload?.replace(/\s/g, '') ?? '';
  return { id, data, log: log.trim().slice(-600) };
}

// --- sticker store ---

async function readIndex() {
  try {
    const parsed = JSON.parse(await readFile(INDEX, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(records) {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INDEX, JSON.stringify(records, null, 2), 'utf8');
}

// --- http ---

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Body too large.');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;

  if (path === '/health') return json(res, 200, { ok: true });

  if (!tokenMatches(req.headers.authorization)) {
    return json(res, 401, { error: 'Unauthorized.' });
  }

  try {
    if (req.method === 'POST' && path === '/v1/agent') {
      const { prompt } = await readBody(req);
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return json(res, 400, { error: 'prompt is required.' });
      }
      return json(res, 200, { output: await runAgent(prompt.slice(0, 40000)) });
    }

    if (req.method === 'POST' && path === '/v1/image') {
      const { prompt, name } = await readBody(req);
      if (typeof prompt !== 'string' || !prompt.trim()) {
        return json(res, 400, { error: 'prompt is required.' });
      }

      const { id, data, log } = await generateImage(prompt.slice(0, 4000));
      if (!data) return json(res, 200, { generated: false, reason: log });

      if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
      await writeFile(join(DATA_DIR, `${id}.png`), Buffer.from(data, 'base64'));

      const record = {
        id,
        name: String(name ?? 'Sticker').slice(0, 60),
        prompt: prompt.slice(0, 800),
        createdAt: new Date().toISOString(),
      };
      await writeIndex([record, ...(await readIndex())]);

      return json(res, 200, { generated: true, ...record });
    }

    if (req.method === 'GET' && path === '/v1/stickers') {
      return json(res, 200, { stickers: await readIndex() });
    }

    const match = path.match(/^\/v1\/stickers\/([^/]+)$/);
    if (match && UUID.test(match[1])) {
      const id = match[1];

      if (req.method === 'GET') {
        try {
          const png = await readFile(join(DATA_DIR, `${id}.png`));
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Cache-Control': 'private, max-age=31536000, immutable',
          });
          return res.end(png);
        } catch {
          return json(res, 404, { error: 'Not found.' });
        }
      }

      if (req.method === 'DELETE') {
        const records = await readIndex();
        if (!records.some((r) => r.id === id)) return json(res, 404, { error: 'Not found.' });
        await writeIndex(records.filter((r) => r.id !== id));
        await unlink(join(DATA_DIR, `${id}.png`)).catch(() => {});
        return json(res, 200, { deleted: true });
      }
    }

    return json(res, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Agent request failed.' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`printops-agent listening on 127.0.0.1:${PORT}, sandbox "${SANDBOX}"`);
});
