export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseColor(input?: string): Rgb | null {
  if (!input) return null;
  const value = input.trim();

  if (HEX.test(value)) {
    const hex = value.slice(1);
    const full =
      hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  const rgb = value.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

export function toHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function channelLuminance(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb): number {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  );
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks whichever of near-black or near-white reads better on the given background. */
export function readableTextColor(background?: string): string | undefined {
  const bg = parseColor(background);
  if (!bg) return undefined;
  const dark = { r: 15, g: 18, b: 22 };
  const light = { r: 248, g: 250, b: 252 };
  return contrastRatio(bg, dark) >= contrastRatio(bg, light)
    ? toHex(dark)
    : toHex(light);
}

export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

/** A surface that sits just off the background, tinted toward the accent. */
export function deriveSurface(background: string, accent: string, mode: 'light' | 'dark'): string {
  const bg = parseColor(background);
  const ac = parseColor(accent);
  if (!bg || !ac) return background;
  const lift = mode === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  return toHex(mix(mix(bg, lift, mode === 'dark' ? 0.06 : 0.035), ac, 0.04));
}

export interface Palette {
  name: string;
  mode: 'light' | 'dark';
  background: string;
  surface: string;
  accent: string;
  border: string;
  description: string;
}

/** Curated combinations. The agent selects one instead of inventing hex codes. */
export const PALETTES: Record<string, Palette> = {
  midnight: {
    name: 'midnight',
    mode: 'dark',
    background: '#0b0f1a',
    surface: '#151b2b',
    accent: '#38bdf8',
    border: 'rgba(148,163,184,0.18)',
    description: 'deep navy with cyan — calm, technical',
  },
  graphite: {
    name: 'graphite',
    mode: 'dark',
    background: '#101113',
    surface: '#1a1c20',
    accent: '#f59e0b',
    border: 'rgba(255,255,255,0.10)',
    description: 'neutral charcoal with amber — industrial, high focus',
  },
  neon: {
    name: 'neon',
    mode: 'dark',
    background: '#08070d',
    surface: '#15121f',
    accent: '#e879f9',
    border: 'rgba(232,121,249,0.22)',
    description: 'near-black with magenta — bold, sticker-shop energy',
  },
  forest: {
    name: 'forest',
    mode: 'dark',
    background: '#0a1410',
    surface: '#122019',
    accent: '#34d399',
    border: 'rgba(52,211,153,0.18)',
    description: 'deep green with mint — natural, easy on the eyes',
  },
  porcelain: {
    name: 'porcelain',
    mode: 'light',
    background: '#f7f8fa',
    surface: '#ffffff',
    accent: '#4f46e5',
    border: 'rgba(15,23,42,0.10)',
    description: 'clean white with indigo — crisp and corporate',
  },
  kraft: {
    name: 'kraft',
    mode: 'light',
    background: '#f4ede2',
    surface: '#fdfaf5',
    accent: '#b45309',
    border: 'rgba(120,83,44,0.18)',
    description: 'warm paper with burnt orange — craft, print-shop feel',
  },
  blueprint: {
    name: 'blueprint',
    mode: 'dark',
    background: '#0d2038',
    surface: '#14304f',
    accent: '#7dd3fc',
    border: 'rgba(125,211,252,0.22)',
    description: 'drafting blue with pale sky — precise, engineered',
  },
  sunset: {
    name: 'sunset',
    mode: 'dark',
    background: '#1a0f1c',
    surface: '#271629',
    accent: '#fb7185',
    border: 'rgba(251,113,133,0.20)',
    description: 'plum with coral — warm, creative',
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES);
