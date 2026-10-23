// Accounts linked on the studio's Instellingen page -> the env vars the publishers read.
// Env vars (GitHub secrets) always win; the studio's links fill in what is not set.
//   shared database (STUDIO_DB, default marketing_studio), collection apps: Meta app, Google client, TikTok app
//   project database, collection connections: which Page/Instagram, YouTube channel, TikTok account
import { MongoClient } from 'mongodb';
import { db } from './db.mjs';
import { open } from './crypto.mjs';

const env = process.env;
const setIfMissing = (k, v) => { if (!env[k] && v) env[k] = String(v); };

export async function sharedDb() {
  const d = await db();                                  // same client, other database
  return d.client.db(env.STUDIO_DB || 'marketing_studio');
}

/** Loads apps + linked accounts into env. Returns which platforms are linked through the studio. */
export async function applyConnections() {
  const linked = {};
  if (!env.ENGINE_KEY) return linked;
  try {
    const apps = Object.fromEntries((await (await sharedDb()).collection('apps').find().toArray()).map(a => {
      try { return [a._id, { id: a.clientId, secret: open(a.secret) }]; } catch { return [a._id, null]; }
    }));
    const conns = Object.fromEntries((await (await db()).collection('connections').find({ secret: { $exists: true } }).toArray()).map(c => {
      try { return [c._id, { account: c.account, secret: open(c.secret) }]; } catch { return [c._id, null]; }
    }));
    if (apps.google) { setIfMissing('YT_CLIENT_ID', apps.google.id); setIfMissing('YT_CLIENT_SECRET', apps.google.secret); }
    if (apps.tiktok) { setIfMissing('TIKTOK_CLIENT_KEY', apps.tiktok.id); setIfMissing('TIKTOK_CLIENT_SECRET', apps.tiktok.secret); }
    const m = conns.meta;
    if (m && !env.META_PAGE_TOKEN) {
      env.META_PAGE_TOKEN = m.secret.pageToken; env.FB_PAGE_ID = m.account.pageId || '';
      if (m.account.igUserId) env.IG_USER_ID = m.account.igUserId; else delete env.IG_USER_ID;
      linked.meta = m.account.name;
    }
    if (conns.google && !env.YT_REFRESH_TOKEN) { env.YT_REFRESH_TOKEN = conns.google.secret.refreshToken; linked.youtube = conns.google.account.name; }
    if (conns.tiktok) { env.TIKTOK_LINKED = '1'; linked.tiktok = conns.tiktok.account.name; }   // tiktok.mjs reads its rotating tokens itself
  } catch (e) { console.error(`connections: ${e.message}`); }
  return linked;
}
