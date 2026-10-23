import { NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { addTestVoice, removeTestVoice } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

// POST { voiceId, ownerId?, name, gender? } : add a voice to the test set
export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { voiceId, ownerId, name, gender } = await req.json().catch(() => ({}));
  if (!/^\w{10,40}$/.test(voiceId || '') || (ownerId && !/^\w{10,80}$/.test(ownerId)) || !name) return NextResponse.json({ error: 'bad input' }, { status: 400 });
  try { return NextResponse.json({ ok: true, list: await addTestVoice(project, voiceId, ownerId, String(name).slice(0, 80), gender === 'male' || gender === 'female' ? gender : undefined) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

// DELETE ?key=... : remove a voice from the test set
export async function DELETE(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!/^[a-z0-9-]{1,40}$/.test(key)) return NextResponse.json({ error: 'bad key' }, { status: 400 });
  return NextResponse.json({ ok: true, list: await removeTestVoice(project, key) });
}
