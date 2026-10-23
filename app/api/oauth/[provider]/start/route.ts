import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { getProject } from '@/lib/projects';
import { META_VERSION, PROVIDERS, getApp, isProvider, redirectUri } from '@/lib/connections';

// "Koppel ..." on the Instellingen page: off to the platform's login and permission screen.
// GET /api/oauth/<meta|google|tiktok>/start?project=<id>
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const project = new URL(req.url).searchParams.get('project') || '';
  if (!isProvider(provider) || !getProject(project)) return NextResponse.json({ error: 'unknown provider or project' }, { status: 404 });
  const app = await getApp(provider);
  if (!app) return NextResponse.redirect(new URL(`/${project}/settings?error=${encodeURIComponent('Vul eerst de app-gegevens in.')}#${provider}`, req.url));

  const state = randomBytes(16).toString('hex');
  const redirect = redirectUri(provider, req);
  let url: URL;
  if (provider === 'meta') {
    url = new URL(`https://www.facebook.com/${META_VERSION}/dialog/oauth`);
    url.search = new URLSearchParams({ client_id: app.clientId, redirect_uri: redirect, state, response_type: 'code',
      ...(app.configId ? { config_id: app.configId } : { scope: PROVIDERS.meta.scopes.join(',') }) }).toString();
  } else if (provider === 'google') {
    url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({ client_id: app.clientId, redirect_uri: redirect, state, response_type: 'code',
      scope: PROVIDERS.google.scopes.join(' '), access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true' }).toString();
  } else {
    url = new URL('https://www.tiktok.com/v2/auth/authorize/');
    url.search = new URLSearchParams({ client_key: app.clientId, redirect_uri: redirect, state, response_type: 'code', scope: PROVIDERS.tiktok.scopes.join(',') }).toString();
  }
  const res = NextResponse.redirect(url);
  res.cookies.set('oauth', Buffer.from(JSON.stringify({ state, project, provider })).toString('base64url'),
    { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 900, path: '/api/oauth' });
  return res;
}
