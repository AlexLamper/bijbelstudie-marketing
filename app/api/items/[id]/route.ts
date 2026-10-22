import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

const NEXT: Record<string, string> = { approve: 'approved', changes: 'changes', reject: 'rejected', reset: 'review' };

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { action, comment } = await req.json();
  const status = NEXT[action];
  if (!status) return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  const db = await getDb();
  const item = await db.collection('items').findOne({ _id: id as any });
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (['published', 'partial'].includes(item.status)) return NextResponse.json({ error: 'already published' }, { status: 409 });
  const update: any = { $set: { status, updatedAt: new Date() }, $push: { history: { at: new Date(), event: action, note: comment } } };
  if (comment) update.$push.reviewComments = { text: comment, at: new Date() };
  await db.collection('items').updateOne({ _id: id as any }, update);
  return NextResponse.json({ ok: true, status });
}
