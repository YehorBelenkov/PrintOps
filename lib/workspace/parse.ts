/**
 * Pulls the first balanced JSON array or object out of noisy CLI output.
 * Candidates are tried in the order they appear, so an object whose fields
 * contain arrays is not mistaken for one of those arrays.
 */
export function extractJsonArray(text: string): unknown[] | null {
  const cleaned = stripCliNoise(text);

  const starts: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '[' || cleaned[i] === '{') starts.push(i);
  }

  for (const start of starts) {
    const open = cleaned[start];
    const close = open === '[' ? ']' : '}';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];

      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;

      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(cleaned.slice(start, i + 1));
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object') return [parsed];
          } catch {
            // Not valid JSON — try the next opening bracket.
          }
          break;
        }
      }
    }
  }

  return null;
}

/** Removes ANSI codes, spinners, box drawing and gateway banners. */
export function stripCliNoise(text: string): string {
  return text
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\u25d0\u25d1\u25d2\u25d3\u25c7\u25c6\u2713\u2717]/g, '')
    .replace(/[\u2500-\u257f]/g, '')
    .replace(/^.*Active gateway set to.*$/gm, '')
    .replace(/^\(node:\d+\).*$/gm, '')
    .replace(/^\(Use `node --trace-warnings.*$/gm, '')
    .replace(/^\[gateway\].*$/gm, '')
    .replace(/^\[proxy\].*$/gm, '')
    .replace(/^\[provider-transport-fetch\].*$/gm, '')
    .replace(/^\[image-generation\].*$/gm, '')
    .replace(/^(provider|model|outputs):\s.*$/gm, '')
    .replace(/^OpenClaw \d+\.\d+\.\d+.*$/gm, '')
    .replace(/^Half butler.*$/gm, '')
    .replace(/```(?:json)?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Collapses a user command into something safe for a single-quoted shell arg. */
export function sanitizeForShell(input: string, maxLength = 1200): string {
  return input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .replace(/'/g, `'"'"'`);
}
