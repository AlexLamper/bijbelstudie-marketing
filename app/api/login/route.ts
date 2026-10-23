import { NextResponse } from 'next/server';
import { sessionValue } from '@/lib/session';
import { safeEqual } from '@/lib/engine-auth';

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get('password') || '');
  const next = String(form.get('next') || '/');
  const expected = process.env.STUDIO_PASSWORD;
  if (!expected || !safeEqual(password, expected)) {
    await new Promise(r => setTimeout(r, 600));             // slows down guessing
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url), 303);
  }
  // only same-site paths, never //evil.com
  const res = NextResponse.redirect(new URL(/^\/(?!\/)/.test(next) ? next : '/', req.url), 303);
  res.cookies.set('studio', await sessionValue(password), { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 864e2, path: '/' });
  return res;
}
