import { NextResponse } from 'next/server';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { engineAuthorized } from '@/lib/engine-auth';

// Gives the engine a short-lived token to upload ONE file to the studio's Blob store,
// so the Blob read-write token never has to leave Vercel.
export async function POST(req: Request) {
  if (!engineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { pathname } = await req.json();
  if (typeof pathname !== 'string' || !/^media\/[\w./-]+$/.test(pathname)) return NextResponse.json({ error: 'bad pathname' }, { status: 400 });
  const token = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    pathname,
    allowedContentTypes: ['video/mp4', 'image/jpeg', 'image/png'],
    maximumSizeInBytes: 200 * 1024 * 1024,
    validUntil: Date.now() + 15 * 60 * 1000,
    addRandomSuffix: false,
  });
  return NextResponse.json({ token });
}
