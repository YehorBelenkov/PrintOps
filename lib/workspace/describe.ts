import { WorkspaceState } from '@/types/workspace.types';

/** Renders current state as compact text the agent can reason about. */
export function describeWorkspace(state: WorkspaceState): string {
  const panels = state.panels.length
    ? [...state.panels]
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((p) => {
          const style = Object.entries(p.style)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
          return `  ${p.id} | "${p.name}" | widget:${p.widget} | col ${p.col}-${
            p.col + p.colSpan - 1
          } row ${p.row}${p.rowSpan > 1 ? `-${p.row + p.rowSpan - 1}` : ''}${
            style ? ` | style: ${style}` : ''
          }`;
        })
        .join('\n')
    : '  (no panels yet)';

  return `WORKSPACE "${state.title}" — ${state.gridColumns}-column grid
THEME: mode=${state.theme.mode} accent=${state.theme.accent} radius=${state.theme.radius}px density=${state.theme.density}
CANVAS: background=${state.theme.background ?? 'default'} surface=${state.theme.surface ?? 'default'} border=${state.theme.border ?? 'default'}
MOTION: effect=${state.theme.effect ?? 'none'} level=${state.theme.motion ?? 'normal'}

PANELS (id | name | widget | position):
${panels}`;
}
