/**
 * Curated motion presets. The agent picks one by name; it never writes CSS,
 * so nothing arbitrary reaches an inline style or stylesheet.
 */

export type CanvasEffect =
  | 'none'
  | 'aurora'
  | 'mesh'
  | 'grid'
  | 'dots'
  | 'waves'
  | 'spotlight'
  | 'scanlines'
  | 'noise';

export const CANVAS_EFFECTS: Record<CanvasEffect, string> = {
  none: 'a flat, still background',
  aurora: 'soft accent-coloured light drifting behind the grid',
  mesh: 'overlapping blurred colour blooms that slowly rearrange',
  grid: 'a faint blueprint grid sliding diagonally',
  dots: 'a subtle dot matrix drifting across the canvas',
  waves: 'a slow rotating sweep of accent light',
  spotlight: 'a breathing glow from the top of the page',
  scanlines: 'fine CRT scanlines creeping downward',
  noise: 'a light film grain over everything',
};

export const CANVAS_EFFECT_NAMES = Object.keys(CANVAS_EFFECTS) as CanvasEffect[];

export type PanelEffect =
  | 'none'
  | 'glass'
  | 'glow'
  | 'lift'
  | 'pulse'
  | 'sheen'
  | 'outline'
  | 'tilt'
  | 'float';

export const PANEL_EFFECTS: Record<PanelEffect, string> = {
  none: 'no extra treatment',
  glass: 'frosted translucent panel that blurs whatever sits behind it',
  glow: 'a soft accent-coloured halo around the panel',
  lift: 'raises toward the cursor on hover',
  pulse: 'a slow accent ring that radiates outward — good for alerts',
  sheen: 'a highlight that sweeps across the surface every few seconds',
  outline: 'an accent light travelling around the border',
  tilt: '3D card that rotates to follow the cursor',
  float: 'drifts up and down continuously as if weightless',
};

export const PANEL_EFFECT_NAMES = Object.keys(PANEL_EFFECTS) as PanelEffect[];

export type MotionLevel = 'off' | 'calm' | 'normal' | 'lively';

export const MOTION_LEVELS: MotionLevel[] = ['off', 'calm', 'normal', 'lively'];

/** Drives --fx-duration; `off` freezes every animation instead. */
export const MOTION_DURATION: Record<MotionLevel, string> = {
  off: '0s',
  calm: '46s',
  normal: '26s',
  lively: '13s',
};
