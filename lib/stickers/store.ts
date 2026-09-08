import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

/** Generated artwork, stored on disk beside a JSON index. Server-only. */
export interface StickerRecord {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
}

const DIR = join(process.cwd(), '.data', 'stickers');
const INDEX = join(DIR, 'index.json');

/** Guards every path built from a caller-supplied id. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidId = (id: string) => ID.test(id);

async function ensureDir() {
  if (!existsSync(DIR)) await mkdir(DIR, { recursive: true });
}

async function readIndex(): Promise<StickerRecord[]> {
  try {
    const raw = await readFile(INDEX, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeIndex(records: StickerRecord[]) {
  await ensureDir();
  await writeFile(INDEX, JSON.stringify(records, null, 2), 'utf8');
}

export async function listStickers(): Promise<StickerRecord[]> {
  const records = await readIndex();
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveSticker(
  id: string,
  png: Buffer,
  meta: { name: string; prompt: string }
): Promise<StickerRecord> {
  if (!isValidId(id)) throw new Error('Invalid sticker id.');
  await ensureDir();
  await writeFile(join(DIR, `${id}.png`), png);

  const record: StickerRecord = {
    id,
    name: meta.name.trim().slice(0, 60) || 'Sticker',
    prompt: meta.prompt.slice(0, 800),
    createdAt: new Date().toISOString(),
  };

  await writeIndex([record, ...(await readIndex()).filter((r) => r.id !== id)]);
  return record;
}

export async function readSticker(id: string): Promise<Buffer | null> {
  if (!isValidId(id)) return null;
  try {
    return await readFile(join(DIR, `${id}.png`));
  } catch {
    return null;
  }
}

export async function deleteSticker(id: string): Promise<boolean> {
  if (!isValidId(id)) return false;
  const records = await readIndex();
  if (!records.some((r) => r.id === id)) return false;

  await writeIndex(records.filter((r) => r.id !== id));
  try {
    await unlink(join(DIR, `${id}.png`));
  } catch {
    // Index entry is gone either way; a missing file is not an error.
  }
  return true;
}
