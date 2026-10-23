import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getProject } from '@/lib/projects';
import { getDb } from '@/lib/mongo';
import { seal } from '@/lib/crypto';
import { META_VERSION, accountOf, getApp, isProvider, redirectUri, saveConnection, studioBase } from '@/lib/connections';
import { checkConnection } from '@/lib/connectionCheck';

export const dynamic = 'force-dynamic';

const back = (req: Request, project: string, provider: string, q: Record<string, string>) =>
  NextResponse.redirect(`${studioBase(req)}/${project}/settings?${new URLSearchParams(q)}#${provider}`, 303);

async function json(r: Response, what: string) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`${what}: ${j.error?.message || j.error_description || j.error || r.status}`);
  return j;
}

// The platform sends you back here after you approved. Exchange the code for tokens and store them.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const jar = await cookies();
  let st: { state: string; project: string; provider: string } | null = null;
  try { st = JSON.parse(Buffer.from(jar.get('oauth')?.value || '', 'base64url').toString()); } catch {}
  if (!isProvider(provider) || !st || st.provider !== provider || !getProject(st.project)) return NextResponse.json({ error: 'Koppelen verlopen - probeer het opnieuw vanaf Instellingen.' }, { status: 400 });
  const { project } = st;
  if (url.searchParams.get('state') !== st.state) return back(req, project, provider, { error: 'Beveiligingscontrole mislukt (state). Probeer opnieuw.' });
  const denied = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (denied) return back(req, project, provider, { error: `Niet gekoppeld: ${denied}` });
  const code = url.searchParams.get('code') || '';
  const app = (await getApp(provider))!;
  const redirect = redirectUri(provider, req);

  try {
    if (provider === 'meta') await connectMeta(project, app, code, redirect);
    else if (provider === 'google') await connectGoogle(project, app, code, redirect);
    else await connectTikTok(project, app, code, redirect);
  } catch (e: any) {
    return back(req, project, provider, { error: e.message.slice(0, 300) });
  }
  await checkConnection(project, provider).catch(() => {});   // shows account details right away
  const res = back(req, project, provider, { ok: provider });
  res.cookies.delete({ name: 'oauth', path: '/api/oauth' });
  return res;
}

// Meta: code -> user token -> long-lived user token -> Pages (each with a Page token that does not
// expire) and the Instagram account linked to each Page. One Page: done. Several: you pick one.
async function connectMeta(project: string, app: any, code: string, redirect: string) {
  const G = (p: string, q: Record<string, string>) => `https://graph.facebook.com/${META_VERSION}/${p}?${new URLSearchParams(q)}`;
  const short = await json(await fetch(G('oauth/access_token', { client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirect, code })), 'Meta code');
  const long = await json(await fetch(G('oauth/access_token', { grant_type: 'fb_exchange_token', client_id: app.clientId, client_secret: app.clientSecret, fb_exchange_token: short.access_token })), 'Meta long-lived token');
  const pages = await json(await fetch(G('me/accounts', { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: '100', access_token: long.access_token })), 'Meta pages');
  const list = (pages.data || []).map((p: any) => ({ pageId: p.id, pageName: p.name, pageToken: p.access_token, igUserId: p.instagram_business_account?.id || null, igUsername: p.instagram_business_account?.username || null }));
  if (!list.length) throw new Error('Geen Facebook-pagina gevonden. Kies bij het inloggen je pagina (en het Instagram-account) en geef toegang.');
  if (list.length === 1) {
    const [p] = list;
    await saveConnection(project, 'meta', accountOf(p), { pageToken: p.pageToken });
    return;
  }
  await (await getDb(project)).collection('connections').updateOne({ _id: 'meta' as any },
    { $set: { pending: seal(list), updatedAt: new Date() }, $setOnInsert: { connectedAt: new Date(), account: {} } }, { upsert: true });
}

async function connectGoogle(project: string, app: any, code: string, redirect: string) {
  const t = await json(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }) }), 'Google token');
  if (!t.refresh_token) throw new Error('Google gaf geen refresh token. Haal de app weg bij myaccount.google.com > Beveiliging > Apps van derden en koppel opnieuw.');
  const ch = await json(await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${t.access_token}` } }), 'YouTube channel');
  const c = ch.items?.[0];
  if (!c) throw new Error('Dit Google-account heeft geen YouTube-kanaal. Kies bij het inloggen het kanaal (merkaccount).');
  await saveConnection(project, 'google', { channelId: c.id, name: c.snippet.title, handle: c.snippet.customUrl || '' }, { refreshToken: t.refresh_token });
}

async function connectTikTok(project: string, app: any, code: string, redirect: string) {
  const t = await json(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: app.clientId, client_secret: app.clientSecret, code, grant_type: 'authorization_code', redirect_uri: redirect }) }), 'TikTok token');
  const u = await json(await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url', { headers: { Authorization: `Bearer ${t.access_token}` } }), 'TikTok user');
  await saveConnection(project, 'tiktok', { openId: t.open_id, name: u.data?.user?.display_name || 'TikTok' },
    { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000, refreshExpiresAt: Date.now() + t.refresh_expires_in * 1000 });
}
