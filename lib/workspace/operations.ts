import {
  Operation,
  OperationResult,
  Panel,
  PanelStyle,
  WorkspaceState,
  WIDGET_TYPES,
  WidgetType,
} from '@/types/workspace.types';
import { PALETTES, PALETTE_NAMES, deriveSurface } from './color';
import { SCENE_PRESETS, SCENE_PRESET_NAMES, sanitizeScene } from './scene';
import { TABLE_NAMES, sanitizePanelData } from '@/lib/data/dataset';
import {
  CANVAS_EFFECT_NAMES,
  MOTION_LEVELS,
  PANEL_EFFECT_NAMES,
  CanvasEffect,
  MotionLevel,
  PanelEffect,
} from './effects';

const MAX_PANELS = 24;
const MAX_ROWS = 40;

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(n)));

const isColor = (v: unknown): v is string =>
  typeof v === 'string' &&
  (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim()) ||
    /^rgba?\([\d\s.,%]+\)$/i.test(v.trim()) ||
    ['transparent', 'inherit', 'currentColor'].includes(v.trim()));

/** Colors plus CSS gradients. Rejects anything that could smuggle in a URL or extra declaration. */
const isBackground = (v: unknown): v is string => {
  if (isColor(v)) return true;
  if (typeof v !== 'string') return false;
  const value = v.trim();
  return (
    /^(linear|radial|conic)-gradient\([^;{}<>]*\)$/i.test(value) &&
    !/url\(|expression|javascript:|@import/i.test(value)
  );
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'panel';

/** Resolve a panel by id, then by name (case/punctuation insensitive). */
function findPanel(state: WorkspaceState, target: unknown): Panel | undefined {
  if (typeof target !== 'string' || !target.trim()) return undefined;
  const key = target.trim();
  const byId = state.panels.find((p) => p.id === key);
  if (byId) return byId;
  const norm = slug(key);
  return state.panels.find(
    (p) => slug(p.name) === norm || slug(p.id) === norm || p.widget === key
  );
}

function uniqueId(state: WorkspaceState, base: string): string {
  let id = slug(base);
  let n = 2;
  while (state.panels.some((p) => p.id === id)) id = `${slug(base)}-${n++}`;
  return id;
}

/** True when this cell rectangle overlaps any existing panel. */
function overlaps(
  state: WorkspaceState,
  col: number,
  colSpan: number,
  row: number,
  rowSpan: number,
  ignoreId?: string
): boolean {
  return state.panels.some(
    (p) =>
      p.id !== ignoreId &&
      row < p.row + p.rowSpan &&
      p.row < row + rowSpan &&
      col < p.col + p.colSpan &&
      p.col < col + colSpan
  );
}

/** First row at or below `from` where the panel fits without overlapping. */
function firstFreeRow(
  state: WorkspaceState,
  col: number,
  colSpan: number,
  rowSpan: number,
  from = 1,
  ignoreId?: string
): number {
  for (let row = Math.max(1, from); row <= MAX_ROWS; row++) {
    if (!overlaps(state, col, colSpan, row, rowSpan, ignoreId)) return row;
  }
  return MAX_ROWS;
}

/**
 * Keeps `anchorId` exactly where it was put and slides everything else down until the
 * grid is clean. Moving a panel onto a taken spot should displace its neighbours, not
 * quietly relocate the panel the user asked to move.
 */
function reflowAround(state: WorkspaceState, anchorId: string): void {
  const anchor = state.panels.find((p) => p.id === anchorId);
  if (!anchor) return;

  const others = state.panels
    .filter((p) => p.id !== anchorId)
    .sort((a, b) => a.row - b.row || a.col - b.col);

  const probe: WorkspaceState = { ...state, panels: [anchor] };
  for (const panel of others) {
    panel.row = firstFreeRow(probe, panel.col, panel.colSpan, panel.rowSpan, panel.row);
    probe.panels.push(panel);
  }
}

function sanitizeStyle(input: Record<string, unknown>): PanelStyle {
  const out: PanelStyle = {};
  if (isBackground(input.background)) out.background = String(input.background).trim();
  if (isColor(input.borderColor)) out.borderColor = String(input.borderColor).trim();
  if (isColor(input.textColor)) out.textColor = String(input.textColor).trim();
  if (isColor(input.accentBar)) out.accentBar = String(input.accentBar).trim();
  if (typeof input.borderWidth === 'number') out.borderWidth = clamp(input.borderWidth, 0, 8);
  if (typeof input.radius === 'number') out.radius = clamp(input.radius, 0, 48);
  if (typeof input.padding === 'number') out.padding = clamp(input.padding, 0, 64);
  if (['none', 'sm', 'md', 'lg'].includes(String(input.shadow)))
    out.shadow = input.shadow as PanelStyle['shadow'];
  if (PANEL_EFFECT_NAMES.includes(String(input.effect) as PanelEffect))
    out.effect = input.effect as PanelEffect;
  return out;
}

/**
 * Applies agent-proposed operations to workspace state.
 * Never throws and never mutates the input — invalid ops are reported and skipped.
 */
export function applyOperations(
  state: WorkspaceState,
  operations: unknown
): { state: WorkspaceState; results: OperationResult[] } {
  const next: WorkspaceState = structuredClone(state);
  const results: OperationResult[] = [];

  if (!Array.isArray(operations)) {
    return {
      state: next,
      results: [{ op: 'none', ok: false, message: 'Agent did not return a list of operations.' }],
    };
  }

  for (const raw of operations) {
    if (!raw || typeof raw !== 'object') {
      results.push({ op: 'unknown', ok: false, message: 'Operation was not an object.' });
      continue;
    }

    const o = raw as Record<string, unknown>;
    const name = String(o.op ?? '');
    const fail = (message: string) => results.push({ op: name, ok: false, message });
    const done = (message: string) => results.push({ op: name, ok: true, message });

    switch (name) {
      case 'setTheme': {
        const changed: string[] = [];
        if (o.mode === 'light' || o.mode === 'dark') {
          next.theme.mode = o.mode;
          changed.push(`mode ${o.mode}`);
        }
        if (isColor(o.accent)) {
          next.theme.accent = String(o.accent).trim();
          changed.push(`accent ${next.theme.accent}`);
        }
        if (typeof o.radius === 'number') {
          next.theme.radius = clamp(o.radius, 0, 48);
          changed.push(`radius ${next.theme.radius}px`);
        }
        if (['compact', 'normal', 'comfortable'].includes(String(o.density))) {
          next.theme.density = o.density as WorkspaceState['theme']['density'];
          changed.push(`density ${next.theme.density}`);
        }
        if (isBackground(o.background)) {
          next.theme.background = String(o.background).trim();
          changed.push('page background');
        }
        if (isBackground(o.surface)) {
          next.theme.surface = String(o.surface).trim();
          changed.push('panel surface');
        }
        if (isColor(o.border)) {
          next.theme.border = String(o.border).trim();
          changed.push('border color');
        }
        // A new canvas without a matching surface would leave panels floating; derive one.
        if (isBackground(o.background) && !isBackground(o.surface)) {
          const bg = String(o.background).trim();
          if (!/gradient/i.test(bg)) {
            next.theme.surface = deriveSurface(bg, next.theme.accent, next.theme.mode);
          }
        }
        changed.length ? done(`Theme: ${changed.join(', ')}`) : fail('No valid theme fields.');
        break;
      }

      case 'applyPalette': {
        const key = String(o.palette ?? '').trim().toLowerCase();
        const palette = PALETTES[key];
        if (!palette) {
          fail(`Unknown palette "${o.palette}". Available: ${PALETTE_NAMES.join(', ')}`);
          break;
        }
        next.theme.mode = palette.mode;
        next.theme.accent = palette.accent;
        next.theme.background = palette.background;
        next.theme.surface = palette.surface;
        next.theme.border = palette.border;

        if (o.resetPanels !== false) {
          for (const panel of next.panels) {
            delete panel.style.background;
            delete panel.style.textColor;
            delete panel.style.borderColor;
          }
        }
        done(`Applied "${palette.name}" palette — ${palette.description}`);
        break;
      }

      case 'setEffect': {
        const changed: string[] = [];
        if (CANVAS_EFFECT_NAMES.includes(String(o.effect) as CanvasEffect)) {
          next.theme.effect = o.effect as CanvasEffect;
          changed.push(`background ${next.theme.effect}`);
        }
        if (MOTION_LEVELS.includes(String(o.motion) as MotionLevel)) {
          next.theme.motion = o.motion as MotionLevel;
          changed.push(`motion ${next.theme.motion}`);
        }
        changed.length
          ? done(`Effect: ${changed.join(', ')}`)
          : fail(`Unknown effect. Available: ${CANVAS_EFFECT_NAMES.join(', ')}`);
        break;
      }

      case 'setScene': {
        const presetKey = String(o.preset ?? '').trim().toLowerCase();
        const preset = presetKey ? SCENE_PRESETS[presetKey] : undefined;

        if (presetKey && !preset) {
          fail(`Unknown scene "${o.preset}". Available: ${SCENE_PRESET_NAMES.join(', ')}`);
          break;
        }

        // Explicit fields layer on top of the preset, so the agent can invent variations.
        const overrides = sanitizeScene({
          particles: o.particles,
          bodies: o.bodies,
          vignette: o.vignette,
        });

        if (!preset && !overrides) {
          fail('Provide a scene preset or particle settings.');
          break;
        }

        const base = preset ? structuredClone(preset.scene) : {};
        next.theme.scene = {
          ...base,
          ...(overrides?.particles
            ? { particles: { ...base.particles, ...overrides.particles } }
            : {}),
          ...(overrides?.bodies ? { bodies: { ...base.bodies, ...overrides.bodies } } : {}),
          ...(overrides?.vignette !== undefined ? { vignette: overrides.vignette } : {}),
        };

        const label = preset ? `"${presetKey}" — ${preset.description}` : 'custom particle scene';
        done(`Scene: ${label}${preset && overrides ? ' (adjusted)' : ''}`);
        break;
      }

      case 'clearScene': {
        next.theme.scene = null;
        done('Removed the particle scene');
        break;
      }

      case 'setTitle': {
        const title = String(o.title ?? '').trim().slice(0, 60);
        if (!title) { fail('Title was empty.'); break; }
        next.title = title;
        done(`Renamed workspace to "${title}"`);
        break;
      }

      case 'addPanel': {
        if (next.panels.length >= MAX_PANELS) { fail(`Panel limit (${MAX_PANELS}) reached.`); break; }
        const widget = String(o.widget ?? '') as WidgetType;
        if (!WIDGET_TYPES.includes(widget)) {
          fail(`Unknown widget "${o.widget}". Valid: ${WIDGET_TYPES.join(', ')}`);
          break;
        }
        const label = String(o.name ?? widget).trim().slice(0, 40) || widget;
        const colSpan = clamp(typeof o.colSpan === 'number' ? o.colSpan : 4, 1, next.gridColumns);
        const col = clamp(typeof o.col === 'number' ? o.col : 1, 1, next.gridColumns - colSpan + 1);
        const rowSpan = clamp(typeof o.rowSpan === 'number' ? o.rowSpan : 1, 1, 4);
        // The model picks rows that are already occupied, so treat its row as a starting
        // point and slide down to the first that actually fits.
        const requestedRow = typeof o.row === 'number' ? clamp(o.row, 1, MAX_ROWS) : 1;
        const row = firstFreeRow(next, col, colSpan, rowSpan, requestedRow);

        const data = sanitizePanelData(o.data);
        if (widget === 'dataTable' && !data) {
          fail(`A dataTable panel needs a valid table. Available: ${TABLE_NAMES.join(', ')}`);
          break;
        }

        next.panels.push({
          id: uniqueId(next, label),
          name: label,
          widget,
          col,
          colSpan,
          row,
          rowSpan,
          style: sanitizeStyle((o.style ?? {}) as Record<string, unknown>),
          ...(data ? { data } : {}),
        });
        done(`Added "${label}" (${data ? `${widget}: ${data.table}` : widget}) at col ${col}, row ${row}, ${colSpan} wide`);
        break;
      }

      case 'removePanel': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        next.panels = next.panels.filter((p) => p.id !== panel.id);
        done(`Removed "${panel.name}"`);
        break;
      }

      case 'movePanel': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        if (typeof o.col === 'number')
          panel.col = clamp(o.col, 1, next.gridColumns - panel.colSpan + 1);
        if (typeof o.row === 'number') panel.row = clamp(o.row, 1, MAX_ROWS);
        reflowAround(next, panel.id);
        done(`Moved "${panel.name}" to col ${panel.col}, row ${panel.row}`);
        break;
      }

      case 'resizePanel': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        if (typeof o.colSpan === 'number') {
          panel.colSpan = clamp(o.colSpan, 1, next.gridColumns);
          panel.col = clamp(panel.col, 1, next.gridColumns - panel.colSpan + 1);
        }
        if (typeof o.rowSpan === 'number') panel.rowSpan = clamp(o.rowSpan, 1, 4);
        done(`Resized "${panel.name}" to ${panel.colSpan}x${panel.rowSpan}`);
        break;
      }

      case 'stylePanel': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        const style = sanitizeStyle(o);
        if (!Object.keys(style).length) { fail('No valid style fields.'); break; }
        panel.style = { ...panel.style, ...style };
        done(`Styled "${panel.name}": ${Object.keys(style).join(', ')}`);
        break;
      }

      case 'renamePanel': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        const label = String(o.name ?? '').trim().slice(0, 40);
        if (!label) { fail('New name was empty.'); break; }
        const old = panel.name;
        panel.name = label;
        done(`Renamed "${old}" to "${label}"`);
        break;
      }

      case 'setWidget': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        const widget = String(o.widget ?? '') as WidgetType;
        if (!WIDGET_TYPES.includes(widget)) { fail(`Unknown widget "${o.widget}".`); break; }
        panel.widget = widget;
        done(`"${panel.name}" now shows ${widget}`);
        break;
      }

      case 'setPanelData': {
        const panel = findPanel(next, o.target);
        if (!panel) { fail(`No panel matching "${o.target}".`); break; }
        const data = sanitizePanelData(o);
        if (!data) {
          fail(`Unknown table "${o.table}". Available: ${TABLE_NAMES.join(', ')}`);
          break;
        }
        panel.widget = 'dataTable';
        panel.data = data;
        done(`"${panel.name}" now shows the ${data.table} table`);
        break;
      }

      case 'swapPanels': {
        const a = findPanel(next, o.target);
        const b = findPanel(next, o.other);
        if (!a || !b) { fail('One or both panels not found.'); break; }
        [a.col, b.col] = [b.col, a.col];
        [a.row, b.row] = [b.row, a.row];
        [a.colSpan, b.colSpan] = [b.colSpan, a.colSpan];
        [a.rowSpan, b.rowSpan] = [b.rowSpan, a.rowSpan];
        done(`Swapped "${a.name}" and "${b.name}"`);
        break;
      }

      case 'clearPanels': {
        const count = next.panels.length;
        next.panels = [];
        done(`Removed all ${count} panels`);
        break;
      }

      case 'suggestStudio': {
        const note = String(o.note ?? '').trim().slice(0, 200);
        done(note || 'Sticker design happens in the Sticker Studio.');
        break;
      }

      default:
        fail(
          name
            ? `Unknown operation "${name}".`
            : 'The agent returned an entry with no "op" field.'
        );
    }
  }

  return { state: next, results };
}
