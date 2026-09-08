import { ImageStyleAnalysis } from '@/types/workspace.types';

const SAMPLE_SIZE = 140;
const QUANT_BITS = 5; // 32 levels per channel

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

interface Bucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

const toHex = (r: number, g: number, b: number) =>
  '#' +
  [r, g, b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('');

function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

const distance = (a: Bucket, b: Bucket) =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

/**
 * Measures colour statistics from a reference image in the browser.
 * Only the resulting numbers are sent to the agent — the image never leaves the client.
 */
export async function analyzeImage(file: File): Promise<ImageStyleAnalysis> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Use a PNG, JPEG, WebP or GIF image.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is larger than 12 MB.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(SAMPLE_SIZE / bitmap.width, SAMPLE_SIZE / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read the image.');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, width, height);
  const shift = 8 - QUANT_BITS;
  const buckets = new Map<number, Bucket>();
  let totalLum = 0;
  let totalSat = 0;
  let counted = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    totalLum += luminance(r, g, b);
    totalSat += saturation(r, g, b);
    counted++;

    const key =
      ((r >> shift) << (QUANT_BITS * 2)) | ((g >> shift) << QUANT_BITS) | (b >> shift);
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  if (!counted) throw new Error('That image appears to be empty.');

  const averaged: Bucket[] = [...buckets.values()]
    .map((b) => ({ r: b.r / b.count, g: b.g / b.count, b: b.b / b.count, count: b.count }))
    .sort((a, b) => b.count - a.count);

  // Fold near-identical buckets together so the palette shows distinct colours.
  const merged: Bucket[] = [];
  for (const bucket of averaged) {
    const near = merged.find((m) => distance(m, bucket) < 28);
    if (near) near.count += bucket.count;
    else merged.push({ ...bucket });
    if (merged.length >= 24) break;
  }
  merged.sort((a, b) => b.count - a.count);

  const palette = merged.slice(0, 6).map((b) => ({
    hex: toHex(b.r, b.g, b.b),
    share: Math.round((b.count / counted) * 100),
  }));

  const background = merged[0];
  const averageLuminance = totalLum / counted;
  const averageSaturation = totalSat / counted;
  const mode: 'light' | 'dark' = luminance(background.r, background.g, background.b) < 0.32
    ? 'dark'
    : 'light';

  // Accent: vivid, visibly different from the background, still a real presence.
  const accentCandidate = merged
    .slice(1)
    .map((b) => ({
      bucket: b,
      score:
        saturation(b.r, b.g, b.b) *
        Math.sqrt(b.count / counted) *
        (distance(b, background) > 60 ? 1 : 0.25),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const accent = accentCandidate?.score
    ? toHex(accentCandidate.bucket.r, accentCandidate.bucket.g, accentCandidate.bucket.b)
    : palette[1]?.hex ?? palette[0].hex;

  const surface = merged[1] ? toHex(merged[1].r, merged[1].g, merged[1].b) : undefined;

  return {
    mode,
    background: toHex(background.r, background.g, background.b),
    surface,
    accent,
    palette,
    averageLuminance: Number(averageLuminance.toFixed(3)),
    averageSaturation: Number(averageSaturation.toFixed(3)),
  };
}
