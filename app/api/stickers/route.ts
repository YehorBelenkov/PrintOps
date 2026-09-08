import { NextResponse } from 'next/server';
import { listStickers } from '@/lib/stickers/store';
import { agentFetch, isRemoteAgent } from '@/lib/agent/runAgent';

export async function GET() {
  if (isRemoteAgent()) {
    const data = await agentFetch<{ stickers: unknown[] }>('/v1/stickers');
    return NextResponse.json(data);
  }
  return NextResponse.json({ stickers: await listStickers() });
}
