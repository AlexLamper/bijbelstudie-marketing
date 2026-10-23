import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';

export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { week } = await req.json();
  if (typeof week !== 'string' || !/^\d{4}-W\d{2}$/.test(week)) return NextResponse.json({ error: 'bad week' }, { status: 400 });
  const r = await (await getDb(project)).collection('items').updateMany({ week, status: 'review' },
    { $set: { status: 'approved', updatedAt: new Date() }, $push: { history: { at: new Date(), event: 'approve-all' } } as any });
  return NextResponse.json({ ok: true, message: `${r.modifiedCount} goedgekeurd` });
}
