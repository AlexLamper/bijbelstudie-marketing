import { NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { sample } from '@/lib/elevenlabs';

// POST { voiceId } -> audio/mpeg: a short Dutch sentence in that voice
export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { voiceId } = await req.json().catch(() => ({}));
  if (!/^\w{10,40}$/.test(voiceId || '')) return NextResponse.json({ error: 'bad voice' }, { status: 400 });
  try { return new NextResponse(new Uint8Array(await sample(project, voiceId)), { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
