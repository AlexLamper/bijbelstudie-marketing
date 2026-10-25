import { NextResponse, type NextRequest } from 'next/server';
import { OLD_HOSTS, STUDIO_HOST, sessionValue } from '@/lib/session';

// The studio is private: one password (STUDIO_PASSWORD), remembered in a cookie for 60 days.
// /api/engine/* has its own auth (x-engine-key = ENGINE_KEY) for the GitHub Actions engine.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // the studio's old address sends its pages to the new one; /api/* stays there (account linking, see lib/session.ts)
  if (OLD_HOSTS.includes(req.headers.get('host') || '') && !pathname.startsWith('/api/')) return NextResponse.redirect(`https://${STUDIO_HOST}${pathname}${req.nextUrl.search}`, 308);
  if (pathname === '/login' || pathname === '/api/login') return NextResponse.next();
  if (pathname.startsWith('/api/oauth/')) return NextResponse.next();   // own checks: start needs the studio cookie or a handoff pass, the callback its state cookie
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
