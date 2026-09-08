'use client';

import { Panel, WorkspaceState } from '@/types/workspace.types';
import { getWidgetComponent } from './widgets/WidgetRegistry';
import { readableTextColor } from '@/lib/workspace/color';
import { MOTION_DURATION } from '@/lib/workspace/effects';
import { SceneCanvas } from './SceneCanvas';
import { useEffect } from 'react';

interface WorkspaceRendererProps {
  state: WorkspaceState;
  highlightId?: string | null;
}

const SHADOWS: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.18)',
  md: '0 4px 12px rgba(0,0,0,0.22)',
  lg: '0 12px 32px rgba(0,0,0,0.30)',
};

const GAP = { compact: '0.5rem', normal: '1rem', comfortable: '1.5rem' } as const;
const ROW_HEIGHT = { compact: 130, normal: 160, comfortable: 190 } as const;

export function WorkspaceRenderer({ state, highlightId }: WorkspaceRendererProps) {
  const { theme, navigation, panels, gridColumns, title } = state;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme.mode === 'dark');
    root.style.setProperty('--accent-color', theme.accent);
    root.style.setProperty('--radius', `${theme.radius}px`);

    // Empty string removes the override and falls back to the stylesheet value.
    root.style.setProperty('--background', theme.background ?? '');
    root.style.setProperty('--card', theme.surface ?? '');
    root.style.setProperty('--border', theme.border ?? '');

    const canvasText = readableTextColor(theme.background);
    root.style.setProperty('--foreground', canvasText ?? '');
    root.style.setProperty('--fx-duration', MOTION_DURATION[theme.motion ?? 'normal']);
  }, [theme]);

  const ordered = [...panels].sort((a, b) => a.row - b.row || a.col - b.col);
  const effect = theme.effect ?? 'none';
  const frozen = theme.motion === 'off';

  return (
    <div className="relative min-h-screen bg-background text-foreground transition-colors">
      {effect !== 'none' && (
        <div className={`fx fx-${effect}${frozen ? ' fx-static' : ''}`} aria-hidden="true" />
      )}
      {theme.scene && !frozen && <SceneCanvas scene={theme.scene} />}

      <nav className="relative z-30 border-b bg-card sticky top-0 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6">
          <div className="flex items-center h-14 sm:h-16 gap-4 sm:gap-8">
            <div className="font-bold text-base sm:text-lg flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: theme.accent }}
              />
              <span className="truncate">{title}</span>
            </div>
            <div className="flex gap-4 sm:gap-6 shrink-0">
              {navigation.map((item) => (
                <a
                  key={item.id}
                  href={item.path}
                  className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 py-5 sm:py-8 pb-32 sm:pb-8">
        {panels.length === 0 ? (
          <div className="border border-dashed rounded-xl py-24 text-center opacity-50">
            <p className="text-sm">
              No panels. Ask the assistant to add one — try &quot;add a revenue panel&quot;.
            </p>
          </div>
        ) : (
          <div
            className="workspace-grid grid"
            style={{
              gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
              gridAutoRows: `minmax(${ROW_HEIGHT[theme.density]}px, auto)`,
              gap: GAP[theme.density],
            }}
          >
            {ordered.map((panel) => (
              <PanelBox
                key={panel.id}
                panel={panel}
                theme={theme}
                highlighted={panel.id === highlightId}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function PanelBox({
  panel,
  theme,
  highlighted,
}: {
  panel: Panel;
  theme: WorkspaceState['theme'];
  highlighted: boolean;
}) {
  const Widget = getWidgetComponent(panel.widget);
  const s = panel.style;

  // A custom panel background can easily clash with the inherited text color.
  const textColor = s.textColor ?? readableTextColor(s.background);
  const effect = s.effect && s.effect !== 'none' ? ` pfx-${s.effect}` : '';
  const tilts = s.effect === 'tilt';

  const track = (event: React.MouseEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const box = el.getBoundingClientRect();
    el.style.setProperty('--tilt-x', String((event.clientX - box.left) / box.width - 0.5));
    el.style.setProperty('--tilt-y', String(0.5 - (event.clientY - box.top) / box.height));
  };

  const release = (event: React.MouseEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--tilt-x', '0');
    event.currentTarget.style.setProperty('--tilt-y', '0');
  };

  return (
    <section
      onMouseMove={tilts ? track : undefined}
      onMouseLeave={tilts ? release : undefined}
      style={{
        gridColumn: `${panel.col} / span ${panel.colSpan}`,
        gridRow: `${panel.row} / span ${panel.rowSpan}`,
        background: s.background ?? 'var(--card)',
        color: textColor,
        borderRadius: s.radius ?? theme.radius,
        borderWidth: s.borderWidth ?? 1,
        borderColor: s.borderColor ?? 'var(--border)',
        borderStyle: 'solid',
        padding: s.padding ?? 20,
        boxShadow: highlighted
          ? '0 0 0 2px var(--accent-color)'
          : SHADOWS[s.shadow ?? 'sm'],
      }}
      className={`relative overflow-hidden transition-all duration-300${effect}`}
    >
      {s.accentBar && (
        <span
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: s.accentBar }}
        />
      )}
      {Widget ? (
        <Widget title={panel.name} compact={panel.colSpan <= 3} data={panel.data} />
      ) : (
        <p className="text-sm text-red-500">
          Unknown widget &quot;{panel.widget}&quot;
        </p>
      )}
    </section>
  );
}

