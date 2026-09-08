/**
 * Sandbox output is mostly banners, Node warnings and proxy chatter. Users need the
 * one line they can act on, not the transcript.
 */

const NOISE =
  /^(\(node:\d+\)|\(Use `node|\[proxy\]|\[gateway\]|\[sandbox-safety-net\]|\[guard\]|\[provider-transport-fetch\]|✓|Active gateway)/;

const FRIENDLY: [RegExp, string][] = [
  [
    /no image-generation model configured/i,
    'Image generation is not configured on the agent yet.',
  ],
  [
    /temporarily overloaded|rate.?limit|\b429\b/i,
    'The image provider is busy right now. Try again in a moment.',
  ],
  [
    /network policy|policy denial|blocked|denied/i,
    'The sandbox blocked the image provider. Its egress policy needs updating.',
  ],
  [
    /unauthorized|invalid api key|\b401\b|\b403\b/i,
    'The image provider rejected the API key.',
  ],
  [/timed out|timeout/i, 'The image provider took too long to respond.'],
];

export function explainFailure(raw: string, fallback: string): string {
  const lines = raw
    .replace(/\u001B\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !NOISE.test(line));

  const joined = lines.join(' ');
  const friendly = FRIENDLY.find(([pattern]) => pattern.test(joined));
  if (friendly) return friendly[1];

  const errorLine = [...lines].reverse().find((line) => /^error\b/i.test(line));
  if (errorLine) return errorLine.replace(/^Error:\s*/i, '').slice(0, 200);

  return lines[lines.length - 1]?.slice(0, 200) ?? fallback;
}
