import { NextResponse, type NextRequest } from 'next/server';
import { sessionValue } from '@/lib/session';

// The studio is private: one password (STUDIO_PASSWORD), remembered in a cookie for 60 days.
// /api/engine/* has its own auth (x-engine-key = ENGINE_KEY) for the GitHub Actions engine.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();
  if (pathname.startsWith('/api/engine/')) return NextResponse.next();
  if (pathname.startsWith('/api/cron/')) return NextResponse.next();   // own auth: Vercel Cron's CRON_SECRET
  const pw = process.env.STUDIO_PASSWORD;
  if (!pw) return new NextResponse('Set STUDIO_PASSWORD to open the studio.', { status: 500 });
  if (req.cookies.get('studio')?.value === (await sessionValue(pw))) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/|favicon.ico|icon.svg).*)'] };
