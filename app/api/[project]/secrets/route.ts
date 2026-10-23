import { NextResponse } from 'next/server';
import { getProject } from '@/lib/projects';
import { deleteSecret, saveSecret } from '@/lib/secrets';

// POST { name, value }: store a key (sealed). DELETE { name }: remove it.
export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { name, value } = await req.json().catch(() => ({}));
  try { await saveSecret(project, String(name), String(value ?? '')); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { name } = await req.json().catch(() => ({}));
  try { await deleteSecret(project, String(name)); return NextResponse.json({ ok: true }); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
