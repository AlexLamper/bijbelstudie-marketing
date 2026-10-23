import { NextResponse } from 'next/server';
import { getSharedDb } from '@/lib/mongo';
import { isProvider, saveApp } from '@/lib/connections';

// Save (POST) or remove (DELETE) the developer app of a platform. Shared by all projects.
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: 'unknown provider' }, { status: 404 });
  const { clientId, clientSecret, configId } = await req.json();
  const id = String(clientId || '').trim(), secret = String(clientSecret || '').trim(), config = String(configId || '').trim();
  if (!/^[\w.\-]{4,200}$/.test(id) || secret.length < 8 || secret.length > 500) return NextResponse.json({ error: 'Vul een geldige ID en secret in.' }, { status: 400 });
  if (config && !/^\d{5,30}$/.test(config)) return NextResponse.json({ error: 'Configuration ID bestaat alleen uit cijfers.' }, { status: 400 });
  await saveApp(provider, id, secret, config || undefined);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isProvider(provider)) return NextResponse.json({ error: 'unknown provider' }, { status: 404 });
  await (await getSharedDb()).collection('apps').deleteOne({ _id: provider as any });
  return NextResponse.json({ ok: true });
}
