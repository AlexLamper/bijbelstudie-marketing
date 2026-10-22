import { NextResponse } from 'next/server';
import { sessionValue } from '@/lib/session';

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '/');
  if (!process.env.STUDIO_PASSWORD || password !== process.env.STUDIO_PASSWORD) {
    return NextResponse.redirect(new URL('/login?error=1', req.url), 303);
  }
  const res = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/', req.url), 303);
  res.cookies.set('studio', await sessionValue(password), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 864e2, path: '/' });
  return res;
}
