import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { engineAuthorized } from '@/lib/engine-auth';

// The engine's daily cleanup removes media of old/rejected items through here.
export async function POST(req: Request) {
  if (!engineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { urls } = await req.json();
  if (!Array.isArray(urls) || !urls.every(u => typeof u === 'string' && u.includes('.blob.vercel-storage.com/media/'))) {
    return NextResponse.json({ error: 'bad urls' }, { status: 400 });
  }
  await del(urls, { token: process.env.BLOB_READ_WRITE_TOKEN });
  return NextResponse.json({ ok: true, deleted: urls.length });
}
