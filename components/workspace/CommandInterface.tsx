'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageStyleAnalysis, OperationResult, WorkspaceState } from '@/types/workspace.types';
import { analyzeImage, ACCEPTED_TYPES } from '@/lib/workspace/imageAnalysis';
import { STICKER_SAVED_EVENT } from './widgets/StickerLibraryWidget';
import { StickerBrief } from '@/lib/sticker/brief';

interface DesignSession {
  request: string;
  brief: StickerBrief;
  askedCount: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: OperationResult[];
  swatches?: string[];
  suggestions?: string[];
  artwork?: string;
  prompt?: string;
}

interface CommandInterfaceProps {
  state: WorkspaceState;
  onStateChange: (state: WorkspaceState) => void;
  onReset: () => void;
}

const SUGGESTIONS = [
  'Add a shipping panel',
  'Make this feel warm and crafty',
  'Design a lion sticker for our branding',
  'Switch to light mode',
];

export function CommandInterface({ state, onStateChange, onReset }: CommandInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [design, setDesign] = useState<DesignSession | null>(null);
  const [pendingField, setPendingField] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isProcessing]);

  const push = (message: Omit<Message, 'id'>) =>
    setMessages((prev) => [...prev, { ...message, id: `${prev.length}-${Date.now()}` }]);

  const send = async (
    text: string,
    options?: { analysis?: ImageStyleAnalysis; swatches?: string[] }
  ) => {
    const trimmed = text.trim();
    if (!trimmed || isProcessing) return;

    push({ role: 'user', content: trimmed, swatches: options?.swatches });
    setInput('');
    setIsProcessing(true);

    // An answer to an open question belongs in the brief before the next turn.
    const session: DesignSession | null =
      design && pendingField
        ? { ...design, brief: { ...design.brief, [pendingField]: trimmed } }
        : design;

    // The agent is stateless, so it needs what it did last turn to understand "no, not that".
    const history = messages.slice(-8).map((m) => ({
      role: m.role,
      text:
        m.role === 'assistant' && m.results?.length
          ? m.results.filter((r) => r.ok).map((r) => r.message).join('; ') || m.content
          : m.content,
    }));

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: trimmed,
          state,
          design: session,
          history,
          analysis: options?.analysis,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Request failed.');

      if (data.mode === 'workspace') {
        setDesign(null);
        setPendingField(null);
        if (data.state) onStateChange(data.state);
        const applied: OperationResult[] = data.results ?? [];
        const ok = applied.filter((r) => r.ok).length;
        push({
          role: 'assistant',
          content:
            data.note ??
            (applied.length
              ? `Applied ${ok} of ${applied.length} change${applied.length === 1 ? '' : 's'}.`
              : 'No changes were needed.'),
          results: applied,
        });
      } else if (data.mode === 'design') {
        setDesign(data.design);
        if (data.status === 'asking') {
          setPendingField(data.field);
          push({ role: 'assistant', content: data.question, suggestions: data.suggestions });
        } else {
          setPendingField(null);
          setImagePrompt(data.imagePrompt ?? '');
          push({
            role: 'assistant',
            content: data.summary || 'The brief is complete.',
            prompt: data.imagePrompt,
          });
        }
      } else {
        push({ role: 'assistant', content: data.text ?? 'No response.' });
      }
    } catch (error) {
      push({
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Something went wrong.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generate = async () => {
    if (!design || isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/sticker/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: design.brief, prompt: imagePrompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Generation failed.');

      if (data.generated) {
        window.dispatchEvent(new CustomEvent(STICKER_SAVED_EVENT));
      }

      push({
        role: 'assistant',
        content: data.generated ? 'Here it is. Saved to your sticker library.' : data.reason,
        artwork: data.generated ? data.url : undefined,
        prompt: data.generated ? undefined : data.prompt,
      });
    } catch (error) {
      push({
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Generation failed.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImage = async (file: File) => {
    if (isProcessing) return;
    try {
      const analysis = await analyzeImage(file);
      await send(`Restyle the workspace to match the reference image "${file.name}".`, {
        analysis,
        swatches: analysis.palette.map((p) => p.hex),
      });
    } catch (error) {
      push({
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Could not read that image.',
      });
    }
  };

  const briefCount = design ? Object.keys(design.brief).length : 0;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleImage(file);
      }}
      className="relative border rounded-t-2xl sm:rounded-xl bg-card text-card-foreground shadow-2xl overflow-hidden flex flex-col max-h-[65vh] sm:max-h-[70vh]"
    >
      {isDragging && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center text-sm font-medium rounded-xl border-2 border-dashed"
          style={{
            borderColor: 'var(--accent-color)',
            background: 'color-mix(in srgb, var(--card) 88%, transparent)',
          }}
        >
          Drop an image to copy its style
        </div>
      )}

      <div className="px-4 py-3 pr-12 sm:pr-4 border-b flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isProcessing ? '#f59e0b' : '#22c55e' }}
            />
            Igor
          </h3>
          <p className="text-xs opacity-50">
            {design
              ? `Design brief — ${briefCount} detail${briefCount === 1 ? '' : 's'} settled`
              : `${state.panels.length} panels on the grid`}
          </p>
        </div>
        <button
          onClick={() => {
            setDesign(null);
            setPendingField(null);
            onReset();
          }}
          className="text-xs opacity-50 hover:opacity-100 transition-opacity"
        >
          Reset
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px]">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs opacity-50 mb-3">Ask about the dashboard or a sticker:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-current/10 hover:border-current/30 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'text-white' : 'bg-current/5'
                }`}
                style={m.role === 'user' ? { backgroundColor: 'var(--accent-color)' } : undefined}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>

                {m.swatches && m.swatches.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {m.swatches.map((hex) => (
                      <span
                        key={hex}
                        title={hex}
                        className="w-5 h-5 rounded border border-white/25"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                )}

                {m.artwork && (
                  <img
                    src={m.artwork}
                    alt="Generated sticker"
                    className="mt-2 w-full rounded-lg"
                    style={{
                      background:
                        'repeating-conic-gradient(rgba(127,127,127,0.18) 0% 25%, transparent 0% 50%) 50%/16px 16px',
                    }}
                  />
                )}

                {m.prompt && (
                  <p className="mt-2 pt-2 border-t border-current/10 text-xs opacity-60 leading-relaxed">
                    {m.prompt}
                  </p>
                )}

                {m.results && m.results.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-current/10 pt-2">
                    {m.results.map((r, i) => (
                      <li
                        key={i}
                        className={`text-xs flex gap-1.5 ${r.ok ? 'opacity-70' : 'text-amber-500'}`}
                      >
                        <span>{r.ok ? '✓' : '!'}</span>
                        <span>{r.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))
        )}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-current/5 rounded-xl px-3 py-2 text-sm opacity-60">
              Igor is thinking…
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {!isProcessing && pendingField && (
          <div className="flex flex-wrap gap-1.5">
            {messages[messages.length - 1]?.suggestions?.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-2.5 py-1.5 rounded-full border border-current/15 hover:border-current/40 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {design && !pendingField && !isProcessing && (
          <button
            onClick={generate}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            Generate artwork
          </button>
        )}

        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImage(file);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isProcessing}
            title="Copy the style from an image"
            className="px-2.5 py-2 rounded-lg border text-sm disabled:opacity-40 hover:border-current/40 transition-colors"
          >
            Image
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={isProcessing}
            placeholder={pendingField ? 'Your answer…' : 'Describe a change…'}
            className="flex-1 min-w-0 bg-transparent border rounded-lg px-3 py-2 text-base sm:text-sm outline-none focus:border-current/40 disabled:opacity-50"
          />
          <button
            onClick={() => send(input)}
            disabled={isProcessing || !input.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
