import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { open } from '@/lib/crypto';
import { accountOf, isProvider, saveConnection } from '@/lib/connections';
import { checkConnection } from '@/lib/connectionCheck';

// POST { pageId }: pick which Facebook Page (and its Instagram) this project posts to.
// POST { test: true }: read-only check that the linked account still works.
export async function POST(req: Request, { params }: { params: Promise<{ project: string; provider: string }> }) {
  const { project, provider } = await params;
  if (!getProject(project) || !isProvider(provider)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.test) return NextResponse.json(await checkConnection(project, provider));
  if (provider !== 'meta') return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { pageId } = body;
  const doc = await (await getDb(project)).collection('connections').findOne({ _id: 'meta' as any });
  if (!doc?.pending) return NextResponse.json({ error: 'Koppel eerst opnieuw.' }, { status: 409 });
  const page = (open<any[]>(doc.pending)).find(p => p.pageId === pageId);
  if (!page) return NextResponse.json({ error: 'Onbekende pagina.' }, { status: 400 });
  await saveConnection(project, 'meta', accountOf(page), { pageToken: page.pageToken });
  await checkConnection(project, 'meta');
  return NextResponse.json({ ok: true });
}

// DELETE: unlink (the engine stops posting there).
export async function DELETE(_req: Request, { params }: { params: Promise<{ project: string; provider: string }> }) {
  const { project, provider } = await params;
  if (!getProject(project) || !isProvider(provider)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await (await getDb(project)).collection('connections').deleteOne({ _id: provider as any });
  return NextResponse.json({ ok: true });
}
