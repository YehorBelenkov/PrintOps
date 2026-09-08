/** A field the interview can ask about. Order is the default priority. */
export interface BriefField {
  id: string;
  label: string;
  hint: string;
  essential: boolean;
  /** Needs the actual words, not a description of them. */
  literal?: boolean;
  followUp?: string;
}

export const BRIEF_FIELDS: BriefField[] = [
  { id: 'subject', label: 'Subject', hint: 'what the sticker depicts, and any pose or angle', essential: true },
  { id: 'usage', label: 'Usage', hint: 'laptop, water bottle, hard hat, packaging seal, shop window', essential: true },
  { id: 'style', label: 'Illustration style', hint: 'mascot, retro badge, line art, vintage engraving, kawaii, geometric, graffiti, flat vector', essential: true },
  { id: 'mood', label: 'Mood', hint: 'fierce, regal, friendly, playful, premium, aggressive', essential: true },
  { id: 'palette', label: 'Colour palette', hint: 'number of colours and which ones; spot colours read better in print', essential: true },
  { id: 'linework', label: 'Linework', hint: 'bold outline, fine line, no outline, woodcut hatching', essential: true },
  { id: 'text', label: 'Text or wordmark', hint: 'the exact words to print, or none', essential: true, literal: true, followUp: 'What should the lettering actually say? Give me the exact words, or say none.' },
  { id: 'typography', label: 'Typography', hint: 'bold slab, condensed sans, brush script, blackletter', essential: false },
  { id: 'shape', label: 'Cut shape', hint: 'die-cut contour, circle, shield badge, rounded rectangle', essential: true },
  { id: 'finish', label: 'Finish', hint: 'matte, gloss, holographic, clear, metallic foil', essential: false },
  { id: 'size', label: 'Size', hint: 'physical size in inches; drives how much detail survives', essential: false },
  { id: 'background', label: 'Background', hint: 'transparent, solid fill, or a white keyline border', essential: false },
  { id: 'complexity', label: 'Detail level', hint: 'flat 2-3 colour screen-print look vs full-colour shading', essential: false },
];

export const FIELD_IDS = BRIEF_FIELDS.map((f) => f.id);
export const ESSENTIAL_IDS = BRIEF_FIELDS.filter((f) => f.essential).map((f) => f.id);

export type StickerBrief = Record<string, string>;

export const MAX_QUESTIONS = 12;
export const MAX_ANSWER_LENGTH = 240;

/** Strips unknown keys and over-long values from agent- or client-supplied briefs. */
export function sanitizeBrief(input: unknown): StickerBrief {
  if (!input || typeof input !== 'object') return {};
  const out: StickerBrief = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!FIELD_IDS.includes(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, MAX_ANSWER_LENGTH);
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

export function missingEssentials(brief: StickerBrief): string[] {
  return ESSENTIAL_IDS.filter((id) => !brief[id]);
}

const PLACEHOLDER =
  /\b(e\.?g\.?|for example|such as|placeholder|your brand|brand name only|tagline only|name only)\b/i;

/** True when an answer describes the kind of value wanted instead of giving one. */
export function looksLikePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (/^(none|no text|nothing|no lettering)\b/i.test(trimmed)) return false;
  return PLACEHOLDER.test(trimmed);
}

/** Returns the first literal field whose answer is not yet a real value. */
export function unresolvedLiteral(brief: StickerBrief): BriefField | undefined {
  return BRIEF_FIELDS.find(
    (f) => f.literal && brief[f.id] && looksLikePlaceholder(brief[f.id])
  );
}

export function buildInterviewPrompt(
  request: string,
  brief: StickerBrief,
  askedCount: number
): string {
  const known = Object.entries(brief)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const outstanding = BRIEF_FIELDS.filter((f) => !brief[f.id])
    .map((f) => `  ${f.id} — ${f.label}: ${f.hint}${f.essential ? ' [essential]' : ''}`)
    .join('\n');

  return `You are a senior sticker designer running a discovery interview with a client.
Your job is to pull the picture out of the client's head before any art is made.

CLIENT'S ORIGINAL REQUEST: ${request}

ALREADY ESTABLISHED:
${known || '  (nothing yet)'}

STILL OPEN:
${outstanding || '  (nothing)'}

Questions asked so far: ${askedCount} of ${MAX_QUESTIONS}.

HOW TO INTERVIEW:
- Ask about ONE field at a time. Never bundle two questions together.
- Pick the field that would most change the final artwork, not simply the next in the list.
- Infer what the request already implies and put it in "known" rather than asking about it.
- Offer 3 to 5 concrete, contrasting options a non-designer can choose between.
- Write like a person talking to a client, not a form. One or two sentences.
- Once every essential field is settled, stop asking and return status "ready".

Reply with ONLY one JSON object, no prose and no markdown fences.

To ask:
{"status":"asking","known":{"<field>":"<value inferred so far>"},"field":"<field id>","question":"<your question>","suggestions":["...","...","..."]}

When the brief is complete:
{"status":"ready","known":{...},"summary":"<one paragraph an illustrator could work from>"}`;
}

/** Assembles the final image-generation prompt from a completed brief. */
export function buildImagePrompt(brief: StickerBrief, summary?: string): string {
  const parts: string[] = ['Professional die-cut vinyl sticker design.'];
  const unquote = (v: string) => v.replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, '').trim();

  if (brief.subject) parts.push(`Subject: ${brief.subject}.`);
  if (brief.style) parts.push(`Illustration style: ${brief.style}.`);
  if (brief.mood) parts.push(`Mood: ${brief.mood}.`);
  if (brief.palette) parts.push(`Colour palette: ${brief.palette}.`);
  if (brief.linework) parts.push(`Linework: ${brief.linework}.`);
  if (brief.complexity) parts.push(`Detail level: ${brief.complexity}.`);

  const text = brief.text ? unquote(brief.text) : '';
  if (text && !/^(none|no text|nothing|no lettering)\b/i.test(text)) {
    parts.push(`The lettering reads exactly: ${text}.`);
    if (brief.typography) parts.push(`Lettering style: ${brief.typography}.`);
  } else {
    parts.push('No text or lettering.');
  }

  if (brief.shape) parts.push(`Cut shape: ${brief.shape}.`);
  if (brief.finish) parts.push(`Intended finish: ${brief.finish}.`);
  if (brief.size) parts.push(`Printed at ${brief.size}.`);
  if (brief.usage) parts.push(`Intended use: ${brief.usage}.`);

  parts.push(
    'Centred composition, clean silhouette that reads at small size, crisp vector-style edges,',
    'thick white die-cut border, isolated on a transparent background, no mockup, no photograph,',
    'no drop shadow, no background scenery.'
  );

  if (summary) parts.push(`Art direction: ${summary}`);

  return parts.join(' ');
}
