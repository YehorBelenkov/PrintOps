import { NextResponse } from 'next/server';
import { deleteSticker, readSticker } from '@/lib/stickers/store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const png = await readSticker(id);

  if (!png) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const removed = await deleteSticker(id);

  return removed
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: 'Not found.' }, { status: 404 });
}
