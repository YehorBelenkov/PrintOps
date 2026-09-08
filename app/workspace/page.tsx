'use client';

import { useEffect, useState } from 'react';
import { WorkspaceRenderer } from '@/components/workspace/WorkspaceRenderer';
import { CommandInterface } from '@/components/workspace/CommandInterface';
import { defaultWorkspace } from '@/lib/workspace/defaultWorkspace';
import { WorkspaceState } from '@/types/workspace.types';

const STORAGE_KEY = 'printops.workspace.v1';

export default function WorkspacePage() {
  const [state, setState] = useState<WorkspaceState>(defaultWorkspace);
  const [panelOpen, setPanelOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Restore after mount so server and client render the same initial markup.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WorkspaceState;
        if (Array.isArray(parsed.panels) && parsed.theme) setState(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  // Gated on hydration: without this the first save runs while state is still the
  // default and overwrites whatever was restored.
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(defaultWorkspace);
  };

  return (
    <div className="relative">
      <WorkspaceRenderer state={state} />

      {panelOpen ? (
        <div className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px] z-50">
          <CommandInterface state={state} onStateChange={setState} onReset={reset} />
          <button
            onClick={() => setPanelOpen(false)}
            className="absolute top-2 right-2 sm:-top-2 sm:-right-2 w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-neutral-700 text-white text-xs hover:bg-neutral-600"
            aria-label="Hide assistant"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg z-50"
          style={{ backgroundColor: 'var(--accent-color)' }}
        >
          Ask Igor
        </button>
      )}
    </div>
  );
}
