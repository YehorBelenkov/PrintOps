import { NextResponse } from 'next/server';
import { deleteSticker, isValidId, readSticker } from '@/lib/stickers/store';
import { AGENT_API_URL, agentFetch, isRemoteAgent } from '@/lib/agent/runAgent';

/** Proxied rather than redirected so the service token never reaches the browser. */
async function fetchRemoteImage(id: string) {
  const response = await fetch(`${AGENT_API_URL}/v1/stickers/${id}`, {
    headers: { Authorization: `Bearer ${process.env.AGENT_TOKEN ?? ''}` },
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const png = isRemoteAgent() ? await fetchRemoteImage(id) : await readSticker(id);
  if (!png) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

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
  if (!isValidId(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (isRemoteAgent()) {
    await agentFetch(`/v1/stickers/${id}`, { method: 'DELETE' });
    return NextResponse.json({ deleted: true });
  }

  return (await deleteSticker(id))
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: 'Not found.' }, { status: 404 });
}
