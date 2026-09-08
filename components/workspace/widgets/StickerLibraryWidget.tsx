'use client';

import { useCallback, useEffect, useState } from 'react';

interface StickerRecord {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
}

/** Generation dispatches this so the library refreshes without a poll. */
export const STICKER_SAVED_EVENT = 'printops:sticker-saved';

export function StickerLibraryWidget({
  title,
  compact,
}: {
  title: string;
  compact?: boolean;
}) {
  const [stickers, setStickers] = useState<StickerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/stickers');
      const data = await response.json();
      setStickers(data.stickers ?? []);
    } catch {
      setStickers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(STICKER_SAVED_EVENT, load);
    return () => window.removeEventListener(STICKER_SAVED_EVENT, load);
  }, [load]);

  const remove = async (id: string) => {
    setPendingId(id);
    try {
      const response = await fetch(`/api/stickers/${id}`, { method: 'DELETE' });
      if (response.ok) setStickers((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase opacity-70">{title}</h3>
        <span className="text-[10px] opacity-40">{stickers.length} saved</span>
      </div>

      {loading ? (
        <p className="text-sm opacity-50">Loading…</p>
      ) : stickers.length === 0 ? (
        <p className="text-sm opacity-50">
          Nothing yet. Ask for a sticker design, then generate the artwork.
        </p>
      ) : (
        <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          {stickers.map((sticker) => (
            <figure key={sticker.id} className="group relative">
              <img
                src={`/api/stickers/${sticker.id}`}
                alt={sticker.name}
                title={sticker.prompt}
                className="w-full aspect-square object-contain rounded-lg"
                style={{
                  background:
                    'repeating-conic-gradient(rgba(127,127,127,0.16) 0% 25%, transparent 0% 50%) 50%/14px 14px',
                }}
              />

              <button
                onClick={() => remove(sticker.id)}
                disabled={pendingId === sticker.id}
                aria-label={`Delete ${sticker.name}`}
                className="hover-reveal absolute top-1 right-1 w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-black/70 text-white text-xs
                           opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity
                           hover:bg-rose-600 disabled:opacity-40"
              >
                {pendingId === sticker.id ? '·' : '✕'}
              </button>

              <figcaption className="mt-1 text-[10px] opacity-60 truncate">
                {sticker.name}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </>
  );
}
