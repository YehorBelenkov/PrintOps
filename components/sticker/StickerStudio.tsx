'use client';

import { useEffect, useRef, useState } from 'react';
import { BRIEF_FIELDS, StickerBrief } from '@/lib/sticker/brief';

interface Turn {
  id: string;
  role: 'agent' | 'client';
  text: string;
}

type Phase = 'idle' | 'interviewing' | 'ready';

const EXAMPLES = [
  'A lion sticker for our branding',
  'Retro badge for a coffee roaster',
  'Mascot decal for a plumbing van',
];

export function StickerStudio() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [request, setRequest] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [brief, setBrief] = useState<StickerBrief>({});
  const [field, setField] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [askedCount, setAskedCount] = useState(0);
  const [summary, setSummary] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [artwork, setArtwork] = useState<string | null>(null);
  const [generateNote, setGenerateNote] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  const addTurn = (role: Turn['role'], text: string) =>
    setTurns((prev) => [...prev, { id: `${role}-${Date.now()}-${prev.length}`, role, text }]);

  const nextTurn = async (nextBrief: StickerBrief, count: number, seed: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: seed,
          state: null,
          design: { request: seed, brief: nextBrief, askedCount: count },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'The interview stalled.');

      const returned: StickerBrief = data.design?.brief ?? nextBrief;
      setBrief(returned);

      if (data.status === 'ready') {
        setPhase('ready');
        setField(null);
        setSuggestions([]);
        setSummary(data.summary ?? '');
        setImagePrompt(data.imagePrompt ?? '');
        addTurn('agent', data.summary || 'The brief is complete.');
      } else {
        setPhase('interviewing');
        setField(data.field);
        setSuggestions(data.suggestions ?? []);
        setAskedCount(count + 1);
        addTurn('agent', data.question);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const start = (text: string) => {
    const seed = text.trim();
    if (!seed || busy) return;
    setRequest(seed);
    setTurns([{ id: 'seed', role: 'client', text: seed }]);
    setBrief({});
    setAskedCount(0);
    setArtwork(null);
    setGenerateNote('');
    nextTurn({}, 0, seed);
  };

  const reply = (text: string) => {
    const value = text.trim();
    if (!value || !field || busy) return;
    addTurn('client', value);
    setAnswer('');
    const merged = { ...brief, [field]: value };
    setBrief(merged);
    nextTurn(merged, askedCount, request);
  };
  const generate = async () => {
    setBusy(true);
    setError('');
    setGenerateNote('');
    try {
      const response = await fetch('/api/sticker/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, summary, prompt: imagePrompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Generation failed.');

      if (data.generated) setArtwork(data.image);
      else setGenerateNote(data.reason ?? 'No provider available.');
      if (data.prompt) setImagePrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  const answered = BRIEF_FIELDS.filter((f) => brief[f.id]);
  const essentialTotal = BRIEF_FIELDS.filter((f) => f.essential).length;
  const essentialDone = BRIEF_FIELDS.filter((f) => f.essential && brief[f.id]).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="border rounded-xl overflow-hidden flex flex-col min-h-[560px]">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Design interview</h2>
          <p className="text-xs opacity-60 mt-0.5">
            Igor asks one question at a time until the brief is unambiguous.
          </p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {phase === 'idle' ? (
            <div className="space-y-3">
              <p className="text-sm opacity-70">What sticker do you need?</p>
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => start(e)}
                  className="block w-full text-left text-sm px-3 py-2.5 rounded-lg border border-current/10 hover:border-current/30 transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
          ) : (
            turns.map((t) => (
              <div
                key={t.id}
                className={`flex ${t.role === 'client' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    t.role === 'client' ? 'text-white' : 'bg-current/5'
                  }`}
                  style={
                    t.role === 'client' ? { backgroundColor: 'var(--accent-color)' } : undefined
                  }
                >
                  {t.text}
                </div>
              </div>
            ))
          )}

          {busy && <p className="text-sm opacity-50">Igor is thinking…</p>}
          {error && <p className="text-sm text-amber-500">{error}</p>}
        </div>

        <div className="p-4 border-t space-y-3">
          {phase === 'interviewing' && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => reply(s)}
                  disabled={busy}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-current/15 hover:border-current/40 disabled:opacity-40 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {phase === 'ready' ? (
            <div className="flex gap-2">
              <button
                onClick={generate}
                disabled={busy}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent-color)' }}
              >
                Generate artwork
              </button>
              <button
                onClick={() => {
                  setPhase('idle');
                  setTurns([]);
                  setBrief({});
                  setArtwork(null);
                  setGenerateNote('');
                  setImagePrompt('');
                }}
                className="px-4 py-2.5 rounded-lg text-sm border"
              >
                Start over
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={phase === 'idle' ? request : answer}
                onChange={(e) =>
                  phase === 'idle' ? setRequest(e.target.value) : setAnswer(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  phase === 'idle' ? start(request) : reply(answer);
                }}
                disabled={busy}
                placeholder={phase === 'idle' ? 'Describe the sticker…' : 'Your answer…'}
                className="flex-1 min-w-0 bg-transparent border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-current/40 disabled:opacity-50"
              />
              <button
                onClick={() => (phase === 'idle' ? start(request) : reply(answer))}
                disabled={busy}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--accent-color)' }}
              >
                {phase === 'idle' ? 'Start' : 'Answer'}
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="border rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold text-sm">Brief</h3>
            <span className="text-xs opacity-50">
              {essentialDone}/{essentialTotal} essentials
            </span>
          </div>

          <div className="h-1 rounded-full bg-current/10 overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(essentialDone / essentialTotal) * 100}%`,
                backgroundColor: 'var(--accent-color)',
              }}
            />
          </div>

          {answered.length === 0 ? (
            <p className="text-xs opacity-50">Nothing established yet.</p>
          ) : (
            <dl className="space-y-2.5">
              {answered.map((f) => (
                <div key={f.id}>
                  <dt className="text-[10px] uppercase tracking-wide opacity-50">{f.label}</dt>
                  <dd className="text-sm">{brief[f.id]}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {artwork && (
          <div className="border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3">Artwork</h3>
            <img
              src={artwork}
              alt="Generated sticker"
              className="w-full rounded-lg"
              style={{
                background:
                  'repeating-conic-gradient(rgba(127,127,127,0.18) 0% 25%, transparent 0% 50%) 50%/16px 16px',
              }}
            />
          </div>
        )}

        {generateNote && (
          <div className="border rounded-xl p-5 text-xs opacity-70 leading-relaxed">
            {generateNote}
          </div>
        )}

        {imagePrompt && (
          <div className="border rounded-xl p-5">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="font-semibold text-sm">Generation prompt</h3>
              <button
                onClick={() => navigator.clipboard?.writeText(imagePrompt)}
                className="text-xs opacity-50 hover:opacity-100"
              >
                Copy
              </button>
            </div>
            <p className="text-xs opacity-70 leading-relaxed">{imagePrompt}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
