import { NextRequest, NextResponse } from 'next/server';
import { applyOperations } from '@/lib/workspace/operations';
import { extractJsonArray, stripCliNoise } from '@/lib/workspace/parse';
import { runAgent, AgentError } from '@/lib/agent/runAgent';
import { buildAssistantPrompt, DesignSession, HistoryTurn } from '@/lib/assistant/prompt';
import {
  BRIEF_FIELDS,
  FIELD_IDS,
  MAX_QUESTIONS,
  buildImagePrompt,
  missingEssentials,
  sanitizeBrief,
  unresolvedLiteral,
  StickerBrief,
} from '@/lib/sticker/brief';
import { ImageStyleAnalysis, WorkspaceState } from '@/types/workspace.types';

export const maxDuration = 220;

const HEX = /^#[0-9a-f]{6}$/i;

/** Renders measured image statistics as evidence the agent can design against. */
function describeAnalysis(a: ImageStyleAnalysis): string {
  const swatches = a.palette
    .filter((p) => HEX.test(p.hex))
    .map((p) => `${p.hex} (${p.share}%)`)
    .join(', ');

  return `REFERENCE IMAGE (measured, not guessed):
  overall: ${a.mode}
  dominant background: ${a.background}
  second surface: ${a.surface ?? 'none'}
  most vivid colour: ${a.accent}
  palette by share: ${swatches}
  average luminance: ${a.averageLuminance} (0=black, 1=white)
  average saturation: ${a.averageSaturation} (0=grey, 1=vivid)

Use these measurements directly: set the canvas to the dominant background, the
surface to the second colour, and the accent to the most vivid colour.`;
}

/** Keeps the interview moving when the agent returns something unusable. */
function fallbackQuestion(brief: StickerBrief) {
  const next =
    BRIEF_FIELDS.find((f) => f.essential && !brief[f.id]) ??
    BRIEF_FIELDS.find((f) => !brief[f.id]);
  if (!next) return null;
  return {
    field: next.id,
    question: `What should the ${next.label.toLowerCase()} be?`,
    suggestions: next.hint.split(/,\s*/).slice(0, 4),
  };
}

const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 240;

function sanitizeHistory(input: unknown): HistoryTurn[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (t): t is { role: string; text: string } =>
        Boolean(t) && typeof t === 'object' && typeof (t as HistoryTurn).text === 'string'
    )
    .map((t) => ({
      role: t.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      text: t.text.replace(/\s+/g, ' ').trim().slice(0, MAX_HISTORY_CHARS),
    }))
    .filter((t) => t.text.length > 0)
    .slice(-MAX_HISTORY_TURNS);
}

export async function POST(request: NextRequest) {
  let body: {
    command?: string;
    state?: WorkspaceState | null;
    design?: DesignSession | null;
    history?: unknown;
    analysis?: ImageStyleAnalysis;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const command = String(body.command ?? '').trim();
  if (!command) {
    return NextResponse.json({ error: 'A message is required.' }, { status: 400 });
  }

  // Public endpoint: a theme that is not an object would crash the operation engine.
  const state =
    body.state &&
    Array.isArray(body.state.panels) &&
    body.state.theme &&
    typeof body.state.theme === 'object'
      ? body.state
      : null;

  const design: DesignSession | null = body.design
    ? {
        request: String(body.design.request ?? command).slice(0, 400),
        brief: sanitizeBrief(body.design.brief),
        askedCount: Math.max(0, Math.min(MAX_QUESTIONS, Number(body.design.askedCount) || 0)),
      }
    : null;

  if (!state && !design) {
    return NextResponse.json(
      { error: 'Provide a workspace state, a design session, or both.' },
      { status: 400 }
    );
  }

  const prompt = buildAssistantPrompt({
    request: command.slice(0, 500),
    state,
    design,
    history: sanitizeHistory(body.history),
    evidence: body.analysis?.palette ? describeAnalysis(body.analysis) : undefined,
  });

  console.log(`Prompt: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens)`);

  let stdout: string;
  try {
    stdout = await runAgent(prompt);
  } catch (error) {
    if (error instanceof AgentError) {
      console.error('Assistant call failed:', error.detail);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }

  const reply = (extractJsonArray(stdout)?.[0] ?? null) as Record<string, unknown> | null;

  if (!reply) {
    return NextResponse.json({
      mode: 'reply',
      text: stripCliNoise(stdout).slice(0, 800) || 'Igor returned nothing.',
    });
  }

  // --- Design interview ---
  if (reply.mode === 'design' || (!state && reply.mode !== 'workspace')) {
    const merged: StickerBrief = { ...(design?.brief ?? {}), ...sanitizeBrief(reply.known) };
    const askedCount = design?.askedCount ?? 0;
    const seed = design?.request ?? command;

    // A category label picked from the chips is not a usable value; ask again.
    const vague = unresolvedLiteral(merged);
    if (vague) {
      delete merged[vague.id];
      return NextResponse.json({
        mode: 'design',
        status: 'asking',
        design: { request: seed, brief: merged, askedCount },
        field: vague.id,
        question: vague.followUp ?? `What exactly should the ${vague.label.toLowerCase()} be?`,
        suggestions: [],
      });
    }

    const outstanding = missingEssentials(merged);

    if ((reply.status === 'ready' && outstanding.length === 0) || askedCount >= MAX_QUESTIONS) {
      const summary = typeof reply.summary === 'string' ? reply.summary.trim().slice(0, 1200) : '';
      return NextResponse.json({
        mode: 'design',
        status: 'ready',
        design: { request: seed, brief: merged, askedCount },
        summary,
        imagePrompt: buildImagePrompt(merged, summary),
      });
    }

    const field = String(reply.field ?? '');
    const question = typeof reply.question === 'string' ? reply.question.trim() : '';
    const usable = FIELD_IDS.includes(field) && !merged[field] && question.length > 0;
    const fallback = usable ? null : fallbackQuestion(merged);

    if (!usable && !fallback) {
      return NextResponse.json({
        mode: 'design',
        status: 'ready',
        design: { request: seed, brief: merged, askedCount },
        summary: '',
        imagePrompt: buildImagePrompt(merged),
      });
    }

    const suggestions = Array.isArray(reply.suggestions)
      ? (reply.suggestions as unknown[])
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s) => s.trim().slice(0, 60))
          .slice(0, 5)
      : [];

    return NextResponse.json({
      mode: 'design',
      status: 'asking',
      design: { request: seed, brief: merged, askedCount: askedCount + 1 },
      field: usable ? field : fallback!.field,
      question: usable ? question.slice(0, 400) : fallback!.question,
      suggestions: usable ? suggestions : fallback!.suggestions,
    });
  }

  // --- Dashboard editing ---
  if (!state) {
    return NextResponse.json({ mode: 'reply', text: 'There is no dashboard open to edit.' });
  }

  const { state: nextState, results } = applyOperations(state, reply.operations);
  const note = typeof reply.note === 'string' ? reply.note.trim().slice(0, 600) : null;

  return NextResponse.json({ mode: 'workspace', state: nextState, results, note });
}
