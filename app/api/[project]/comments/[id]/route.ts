import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';

export async function PATCH(req: Request, { params }: { params: Promise<{ project: string; id: string }> }) {
  const { project, id } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { status } = await req.json();
  if (!['done', 'skip', 'new'].includes(status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
  await (await getDb(project)).collection('comments').updateOne({ _id: id as any }, { $set: { status, handledAt: new Date() } });
  return NextResponse.json({ ok: true });
}
