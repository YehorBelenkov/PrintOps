/**
 * A parameterised particle scene. The agent supplies numbers, enums and hex
 * colours only — never code — so novel scenes are possible without letting
 * anything executable near the page.
 */

export type ParticleShape = 'dot' | 'streak' | 'star' | 'flake' | 'bubble' | 'square' | 'ring';

export type ParticleDirection = 'down' | 'up' | 'left' | 'right' | 'drift' | 'burst';

export interface ParticleConfig {
  count: number;
  shape: ParticleShape;
  minSize: number;
  maxSize: number;
  speed: number; // pixels per second
  direction: ParticleDirection;
  sway: number; // sideways wander, 0 = dead straight
  colors: string[];
  minOpacity: number;
  maxOpacity: number;
  twinkle: boolean;
  trail: number; // 0-1, streak length as a fraction of travel
  parallax: number; // 0-1, how much depth varies size and speed
  spin: number; // rotations per second
}

/** Large soft shapes behind the particles — planets, orbs, distant light. */
export interface BodyConfig {
  count: number;
  colors: string[];
  minSize: number; // percentage of viewport width
  maxSize: number;
  speed: number;
  glow: number; // 0-1
  ring: boolean;
}

export interface SceneConfig {
  particles?: ParticleConfig;
  bodies?: BodyConfig;
  vignette?: number; // 0-1 darkening at the edges
}

export const MAX_PARTICLES = 420;
export const MAX_BODIES = 5;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const SHAPES: ParticleShape[] = ['dot', 'streak', 'star', 'flake', 'bubble', 'square', 'ring'];
const DIRECTIONS: ParticleDirection[] = ['down', 'up', 'left', 'right', 'drift', 'burst'];

const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

const colors = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) return fallback;
  const clean = value.filter((c): c is string => typeof c === 'string' && HEX.test(c.trim()));
  return clean.length ? clean.slice(0, 6).map((c) => c.trim()) : fallback;
};

export function sanitizeScene(input: unknown): SceneConfig | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const scene: SceneConfig = {};

  if (raw.particles && typeof raw.particles === 'object') {
    const p = raw.particles as Record<string, unknown>;
    const minSize = num(p.minSize, 0.5, 40, 2);
    const minOpacity = num(p.minOpacity, 0, 1, 0.35);
    scene.particles = {
      count: Math.round(num(p.count, 0, MAX_PARTICLES, 120)),
      shape: SHAPES.includes(p.shape as ParticleShape) ? (p.shape as ParticleShape) : 'dot',
      minSize,
      maxSize: num(p.maxSize, minSize, 48, Math.max(minSize, 4)),
      speed: num(p.speed, 0, 900, 60),
      direction: DIRECTIONS.includes(p.direction as ParticleDirection)
        ? (p.direction as ParticleDirection)
        : 'drift',
      sway: num(p.sway, 0, 120, 8),
      colors: colors(p.colors, ['#ffffff']),
      minOpacity,
      maxOpacity: num(p.maxOpacity, minOpacity, 1, Math.max(minOpacity, 0.9)),
      twinkle: Boolean(p.twinkle),
      trail: num(p.trail, 0, 1, 0),
      parallax: num(p.parallax, 0, 1, 0.4),
      spin: num(p.spin, 0, 3, 0),
    };
  }

  if (raw.bodies && typeof raw.bodies === 'object') {
    const b = raw.bodies as Record<string, unknown>;
    const minSize = num(b.minSize, 4, 70, 14);
    scene.bodies = {
      count: Math.round(num(b.count, 0, MAX_BODIES, 2)),
      colors: colors(b.colors, ['#6366f1', '#f59e0b']),
      minSize,
      maxSize: num(b.maxSize, minSize, 80, Math.max(minSize, 26)),
      speed: num(b.speed, 0, 40, 4),
      glow: num(b.glow, 0, 1, 0.5),
      ring: Boolean(b.ring),
    };
  }

  if (typeof raw.vignette === 'number') scene.vignette = num(raw.vignette, 0, 1, 0);

  return scene.particles || scene.bodies || scene.vignette !== undefined ? scene : null;
}

/** Starting points the agent can name, then adjust with explicit fields. */
export const SCENE_PRESETS: Record<string, { description: string; scene: SceneConfig }> = {
  space: {
    description: 'starfield with drifting planets',
    scene: {
      particles: {
        count: 260, shape: 'star', minSize: 0.8, maxSize: 2.6, speed: 6,
        direction: 'drift', sway: 4, colors: ['#ffffff', '#cbd5e1', '#a5b4fc'],
        minOpacity: 0.2, maxOpacity: 1, twinkle: true, trail: 0, parallax: 0.8, spin: 0,
      },
      bodies: {
        count: 2, colors: ['#6366f1', '#f472b6'], minSize: 16, maxSize: 30,
        speed: 3, glow: 0.6, ring: true,
      },
      vignette: 0.55,
    },
  },
  waterfall: {
    description: 'fast falling water streaks with mist',
    scene: {
      particles: {
        count: 320, shape: 'streak', minSize: 1, maxSize: 2.5, speed: 620,
        direction: 'down', sway: 6, colors: ['#7dd3fc', '#bae6fd', '#e0f2fe'],
        minOpacity: 0.15, maxOpacity: 0.75, twinkle: false, trail: 0.85, parallax: 0.6, spin: 0,
      },
      vignette: 0.25,
    },
  },
  rain: {
    description: 'thin fast rainfall',
    scene: {
      particles: {
        count: 260, shape: 'streak', minSize: 0.8, maxSize: 1.6, speed: 700,
        direction: 'down', sway: 2, colors: ['#94a3b8', '#cbd5e1'],
        minOpacity: 0.15, maxOpacity: 0.5, twinkle: false, trail: 0.9, parallax: 0.5, spin: 0,
      },
    },
  },
  snow: {
    description: 'slow drifting snowflakes',
    scene: {
      particles: {
        count: 160, shape: 'flake', minSize: 2, maxSize: 6, speed: 46,
        direction: 'down', sway: 44, colors: ['#ffffff', '#e0f2fe'],
        minOpacity: 0.3, maxOpacity: 0.9, twinkle: false, trail: 0, parallax: 0.7, spin: 0.4,
      },
    },
  },
  embers: {
    description: 'warm sparks rising from below',
    scene: {
      particles: {
        count: 140, shape: 'dot', minSize: 1, maxSize: 3.4, speed: 54,
        direction: 'up', sway: 30, colors: ['#f97316', '#fbbf24', '#ef4444'],
        minOpacity: 0.2, maxOpacity: 0.95, twinkle: true, trail: 0.25, parallax: 0.7, spin: 0,
      },
      vignette: 0.4,
    },
  },
  bubbles: {
    description: 'soft bubbles floating upward',
    scene: {
      particles: {
        count: 90, shape: 'bubble', minSize: 4, maxSize: 18, speed: 40,
        direction: 'up', sway: 34, colors: ['#67e8f9', '#a5f3fc', '#ffffff'],
        minOpacity: 0.12, maxOpacity: 0.45, twinkle: false, trail: 0, parallax: 0.6, spin: 0,
      },
    },
  },
  fireflies: {
    description: 'slow glowing points wandering in the dark',
    scene: {
      particles: {
        count: 70, shape: 'dot', minSize: 1.5, maxSize: 4, speed: 16,
        direction: 'drift', sway: 60, colors: ['#fde047', '#bef264'],
        minOpacity: 0.1, maxOpacity: 1, twinkle: true, trail: 0, parallax: 0.5, spin: 0,
      },
      vignette: 0.5,
    },
  },
  confetti: {
    description: 'falling tumbling paper squares',
    scene: {
      particles: {
        count: 180, shape: 'square', minSize: 3, maxSize: 8, speed: 130,
        direction: 'down', sway: 60, colors: ['#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7'],
        minOpacity: 0.6, maxOpacity: 1, twinkle: false, trail: 0, parallax: 0.5, spin: 1.4,
      },
    },
  },
  dust: {
    description: 'barely-there motes in the air',
    scene: {
      particles: {
        count: 110, shape: 'dot', minSize: 0.8, maxSize: 2.2, speed: 10,
        direction: 'drift', sway: 25, colors: ['#ffffff'],
        minOpacity: 0.06, maxOpacity: 0.3, twinkle: false, trail: 0, parallax: 0.6, spin: 0,
      },
    },
  },
  warp: {
    description: 'stars streaking outward from the centre',
    scene: {
      particles: {
        count: 220, shape: 'streak', minSize: 1, maxSize: 3, speed: 260,
        direction: 'burst', sway: 0, colors: ['#ffffff', '#93c5fd'],
        minOpacity: 0.2, maxOpacity: 1, twinkle: false, trail: 0.7, parallax: 0.9, spin: 0,
      },
      vignette: 0.6,
    },
  },
};

export const SCENE_PRESET_NAMES = Object.keys(SCENE_PRESETS);
