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

async function runAgent(prompt, timeoutSeconds = 180) {
  const id = randomUUID();
  const promptPath = `/tmp/printops-${id}.txt`;
  const scriptPath = `/tmp/printops-${id}.sh`;
  const script = `openclaw capability model run --thinking off --prompt "$(cat ${promptPath})"`;

  return runInSandbox(
    `echo ${b64(prompt)} | base64 -d > ${promptPath}; ` +
      `echo ${b64(script)} | base64 -d > ${scriptPath}; ` +
      `bash ${scriptPath}; rm -f ${promptPath} ${scriptPath}`,
    timeoutSeconds
  );
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
