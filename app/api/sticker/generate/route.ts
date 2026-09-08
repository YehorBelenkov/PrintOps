import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { runInSandbox, AgentError, agentFetch, isRemoteAgent } from '@/lib/agent/runAgent';
import { explainFailure } from '@/lib/agent/explainFailure';
import { buildImagePrompt, sanitizeBrief } from '@/lib/sticker/brief';
import { saveSticker } from '@/lib/stickers/store';

export const maxDuration = 240;

const GENERATE_TIMEOUT_SECONDS = 200;

/** Reads the provider list and reports which ones have credentials configured. */
async function configuredProviders(): Promise<string[]> {
  const out = await runInSandbox('openclaw capability image providers', 60);
  const providers: string[] = [];

  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const entry = JSON.parse(trimmed) as { id?: string; configured?: boolean };
      if (entry.configured && entry.id) providers.push(entry.id);
    } catch {
      // Not a provider record; the CLI also emits banners on this stream.
    }
  }
  return providers;
}

export async function POST(request: NextRequest) {
  let body: { brief?: unknown; summary?: string; prompt?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const brief = sanitizeBrief(body.brief);
  const summary = String(body.summary ?? '').slice(0, 1200);
  const prompt =
    String(body.prompt ?? '').trim().slice(0, 2000) || buildImagePrompt(brief, summary);

  if (!prompt) {
    return NextResponse.json({ error: 'Nothing to generate yet.' }, { status: 400 });
  }

  const name = brief.subject ? `${brief.subject} sticker` : 'Sticker';

  // The agent service owns generation and storage when the sandbox is remote.
  if (isRemoteAgent()) {
    try {
      const result = await agentFetch<{
        generated: boolean;
        id?: string;
        reason?: string;
      }>('/v1/image', {
        method: 'POST',
        body: JSON.stringify({ prompt, name }),
        signal: AbortSignal.timeout((GENERATE_TIMEOUT_SECONDS + 30) * 1000),
      });

      return result.generated
        ? NextResponse.json({
            generated: true,
            prompt,
            id: result.id,
            url: `/api/stickers/${result.id}`,
          })
        : NextResponse.json({
            generated: false,
            prompt,
            reason: explainFailure(result.reason ?? '', 'The provider returned no image.'),
          });
    } catch (error) {
      if (error instanceof AgentError) {
        return NextResponse.json({ error: error.message, prompt }, { status: 502 });
      }
      throw error;
    }
  }

  let providers: string[];
  try {
    providers = await configuredProviders();
  } catch (error) {
    if (error instanceof AgentError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  if (providers.length === 0) {
    return NextResponse.json({
      generated: false,
      prompt,
      reason:
        'No image generation provider is configured in OpenClaw. Add a key for fal, ' +
        'OpenAI, Google or xAI. The prompt below is ready to paste into any of them.',
    });
  }

  const id = randomUUID();
  const outputPath = `/tmp/sticker-${id}.png`;
  const promptPath = `/tmp/sticker-${id}.txt`;
  const scriptPath = `/tmp/sticker-${id}.sh`;

  // Same staging trick as runAgent: quotes and newlines cannot survive the
  // Windows -> WSL -> bash -> sandbox chain, so only base64 travels.
  const script =
    `openclaw capability image generate --prompt "$(cat ${promptPath})" ` +
    `--output-format png --background transparent --size 1024x1024 ` +
    `--output ${outputPath} --json`;

  const inner =
    `echo ${Buffer.from(prompt, 'utf8').toString('base64')} | base64 -d > ${promptPath}; ` +
    `echo ${Buffer.from(script, 'utf8').toString('base64')} | base64 -d > ${scriptPath}; ` +
    `bash ${scriptPath}; ` +
    `echo ---IMAGE---; base64 -w0 ${outputPath} 2>/dev/null; ` +
    `rm -f ${promptPath} ${scriptPath} ${outputPath}`;

  let out: string;
  try {
    out = await runInSandbox(inner, GENERATE_TIMEOUT_SECONDS);
  } catch (error) {
    if (error instanceof AgentError) {
      return NextResponse.json({ error: error.message, prompt }, { status: 502 });
    }
    throw error;
  }

  const [log, payload] = out.split('---IMAGE---');
  const base64 = payload?.replace(/\s/g, '') ?? '';

  if (!base64) {
    return NextResponse.json({
      generated: false,
      prompt,
      reason: explainFailure(log, 'The provider returned no image.'),
    });
  }

  const record = await saveSticker(id, Buffer.from(base64, 'base64'), { name, prompt });

  return NextResponse.json({
    generated: true,
    prompt,
    provider: providers[0],
    id: record.id,
    url: `/api/stickers/${record.id}`,
  });
}
