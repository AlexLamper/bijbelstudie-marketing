import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await req.json();
  if (!['done', 'skip', 'new'].includes(status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
  await (await getDb()).collection('comments').updateOne({ _id: id as any }, { $set: { status, handledAt: new Date() } });
  return NextResponse.json({ ok: true });
}
