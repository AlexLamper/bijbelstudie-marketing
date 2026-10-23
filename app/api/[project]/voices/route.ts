import { NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { chooseVoice, listVoices } from '@/lib/elevenlabs';

export const dynamic = 'force-dynamic';

// GET ?gender=male|female : your voices + Dutch voices from the ElevenLabs library
export async function GET(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const gender = new URL(req.url).searchParams.get('gender') || undefined;
  try { return NextResponse.json(await listVoices(project, gender === 'male' || gender === 'female' ? gender : undefined)); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

// POST { role: male|female, voiceId, ownerId?, name? } : use this voice for the explainer reels
export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { role, voiceId, ownerId, name } = await req.json().catch(() => ({}));
  if ((role !== 'male' && role !== 'female') || !/^\w{10,40}$/.test(voiceId || '') || (ownerId && !/^\w{10,80}$/.test(ownerId))) return NextResponse.json({ error: 'bad input' }, { status: 400 });
  try { return NextResponse.json({ ok: true, id: await chooseVoice(project, role, voiceId, ownerId, String(name || '').slice(0, 60)) }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
