import { getDb } from './mongo';
import { open, seal } from './crypto';
import { META_VERSION, getApp, type ProviderId } from './connections';

// Read-only check that a linked account still works: no posting, only "who am I" calls.
// The result is stored on the connection (lastCheck) and shown on the Instellingen page.

export type CheckResult = { ok: boolean; detail: string };

async function json(r: Response, what: string) {
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error?.message || (typeof j.error === 'string' && j.error) || (j.error?.code && j.error.code !== 'ok'))
    throw new Error(`${what}: ${j.error?.message || j.error_description || j.error?.code || j.error || r.status}`);
  return j;
}

async function checkMeta(secret: any, account: any): Promise<string> {
  const G = (p: string, q: Record<string, string>) => `https://graph.facebook.com/${META_VERSION}/${p}?${new URLSearchParams({ ...q, access_token: secret.pageToken })}`;
  const page = await json(await fetch(G(account.pageId, { fields: 'name,fan_count' })), 'Facebook-pagina');
  let line = `Facebook: ${page.name}`;
  if (account.igUserId) {
    const ig = await json(await fetch(G(account.igUserId, { fields: 'username,followers_count,media_count' })), 'Instagram');
    line += ` - Instagram: @${ig.username}, ${ig.followers_count} volgers, ${ig.media_count} posts`;
  } else line += ' - geen Instagram-account aan deze pagina gekoppeld';
  return line;
}

async function checkGoogle(secret: any): Promise<string> {
  const app = await getApp('google'); if (!app) throw new Error('Google-app ontbreekt');
  const t = await json(await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    client_id: app.clientId, client_secret: app.clientSecret, refresh_token: secret.refreshToken, grant_type: 'refresh_token' }) }), 'Google token');
  const ch = await json(await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: `Bearer ${t.access_token}` } }), 'YouTube');
  const c = ch.items?.[0]; if (!c) throw new Error('Geen kanaal gevonden');
  return `YouTube: ${c.snippet.title}${c.snippet.customUrl ? ` (${c.snippet.customUrl})` : ''}, ${c.statistics.subscriberCount ?? 0} abonnees, ${c.statistics.videoCount ?? 0} video's`;
}

async function checkTikTok(project: string, secret: any): Promise<string> {
  let s = secret;
  if (!s.accessToken || s.expiresAt < Date.now() + 60_000) {
    const app = await getApp('tiktok'); if (!app) throw new Error('TikTok-app ontbreekt');
    const t = await json(await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: app.clientId, client_secret: app.clientSecret, grant_type: 'refresh_token', refresh_token: s.refreshToken }) }), 'TikTok token');
    s = { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + t.expires_in * 1000, refreshExpiresAt: Date.now() + t.refresh_expires_in * 1000 };
    await (await getDb(project)).collection('connections').updateOne({ _id: 'tiktok' as any }, { $set: { secret: seal(s), updatedAt: new Date() } });
  }
  const c = await json(await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', { method: 'POST',
    headers: { Authorization: `Bearer ${s.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: '{}' }), 'TikTok');
  // creator_info lists PUBLIC_TO_EVERYONE even for apps TikTok has not audited yet; those posts still land as private
  const name = c.data?.creator_username ? `@${c.data.creator_username}` : c.data?.creator_nickname || 'account';
  // the public profile name, for the Kanalen page (linking only gives the display name)
  if (c.data?.creator_username) await (await getDb(project)).collection('connections').updateOne({ _id: 'tiktok' as any }, { $set: { 'account.username': c.data.creator_username } });
  return `TikTok: ${name} - posts blijven privé tot TikTok de app goedkeurt`;
}

export async function checkConnection(project: string, provider: ProviderId): Promise<CheckResult> {
  const col = (await getDb(project)).collection('connections');
  const c = await col.findOne({ _id: provider as any });
  if (!c?.secret) return { ok: false, detail: 'Niet gekoppeld' };
  let secret: any;
  try { secret = open<any>(c.secret); }
  catch { return { ok: false, detail: 'Kan de opgeslagen tokens niet lezen (is ENGINE_KEY gewijzigd?) - koppel opnieuw.' }; }
  let result: CheckResult;
  try {
    const detail = provider === 'meta' ? await checkMeta(secret, c.account) : provider === 'google' ? await checkGoogle(secret) : await checkTikTok(project, secret);
    result = { ok: true, detail };
  } catch (e: any) { result = { ok: false, detail: String(e.message).slice(0, 300) }; }
  await col.updateOne({ _id: provider as any }, { $set: { lastCheck: { at: new Date(), ...result } } });
  return result;
}
