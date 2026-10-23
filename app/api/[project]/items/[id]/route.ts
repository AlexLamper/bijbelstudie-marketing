import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';

const NEXT: Record<string, string> = { approve: 'approved', changes: 'changes', reject: 'rejected', reset: 'review' };

export async function PATCH(req: Request, { params }: { params: Promise<{ project: string; id: string }> }) {
  const { project, id } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { action, comment } = await req.json();
  const status = NEXT[action];
  if (!status) return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  if (action === 'changes' && !String(comment || '').trim()) return NextResponse.json({ error: 'Schrijf wat er anders moet.' }, { status: 400 });
  const db = await getDb(project);
  const item = await db.collection('items').findOne({ _id: id as any });
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (['published', 'partial'].includes(item.status)) return NextResponse.json({ error: 'Al gepubliceerd' }, { status: 409 });
  const note = comment ? String(comment).slice(0, 2000) : undefined;
  const update: any = { $set: { status, updatedAt: new Date() }, $push: { history: { at: new Date(), event: action, note } } };
  if (note) update.$push.reviewComments = { text: note, at: new Date() };
  await db.collection('items').updateOne({ _id: id as any }, update);
  return NextResponse.json({ ok: true, status });
}
