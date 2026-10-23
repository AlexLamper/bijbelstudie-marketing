import { getDb, getSharedDb } from './mongo';
import { open, seal } from './crypto';

// Linking social accounts from the studio (OAuth). Two levels:
//   app        one developer app per platform, shared by all projects (Meta app, Google OAuth client,
//              TikTok app) - stored encrypted in the shared studio database, or set as env vars
//   connection one linked account per project and platform (which Page/Instagram, which channel,
//              which TikTok) - stored encrypted in the project's database, collection `connections`
// The engine reads both (engine/connections.mjs) and posts with them.

export type ProviderId = 'meta' | 'google' | 'tiktok';

export const META_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

export const PROVIDERS: Record<ProviderId, {
  name: string; platforms: string; idLabel: string; secretLabel: string; console: string; consoleName: string;
  env: [string, string]; scopes: string[]; steps: string[];
}> = {
  meta: {
    name: 'Instagram + Facebook', platforms: 'instagram, facebook', idLabel: 'App ID', secretLabel: 'App secret (geheime sleutel)',
    console: 'https://developers.facebook.com/apps/', consoleName: 'Meta for Developers', env: ['META_APP_ID', 'META_APP_SECRET'],
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights', 'instagram_manage_comments',
      'pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'],
    steps: ['Maak een app (type Business) en voeg Facebook Login toe.', 'Zet de redirect-URL hieronder bij Facebook Login > Settings > Valid OAuth Redirect URIs.', 'Kopieer App ID en App secret (App settings > Basic).'],
  },
  google: {
    name: 'YouTube Shorts', platforms: 'youtube', idLabel: 'Client ID', secretLabel: 'Client secret',
    console: 'https://console.cloud.google.com/apis/credentials', consoleName: 'Google Cloud Console', env: ['YT_CLIENT_ID', 'YT_CLIENT_SECRET'],
    scopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
    steps: ['Zet YouTube Data API v3 aan en publiceer het OAuth-toestemmingsscherm.', 'Maak een OAuth client ID (Web application) met de redirect-URL hieronder.', 'Kopieer Client ID en Client secret.'],
  },
  tiktok: {
    name: 'TikTok', platforms: 'tiktok', idLabel: 'Client key', secretLabel: 'Client secret',
    console: 'https://developers.tiktok.com/apps/', consoleName: 'TikTok for Developers', env: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    scopes: ['user.info.basic', 'user.info.stats', 'video.publish', 'video.upload', 'video.list'],
    steps: ['Maak een app met Login Kit en Content Posting API (Direct Post).', 'Zet de redirect-URL hieronder bij Login Kit.', 'Kopieer Client key en Client secret. Tot TikTok de app goedkeurt, worden posts privé geplaatst.'],
  },
};
export const isProvider = (p: string): p is ProviderId => p in PROVIDERS;

/** Which provider posts to which platform. */
export const PLATFORM_PROVIDER: Record<string, ProviderId> = { instagram: 'meta', facebook: 'meta', youtube: 'google', tiktok: 'tiktok' };

export type App = { clientId: string; clientSecret: string; configId?: string; source: 'env' | 'studio' };

/** The developer app for a provider: env vars win, else what was saved on the Instellingen page. */
export async function getApp(provider: ProviderId): Promise<App | null> {
  const [idVar, secretVar] = PROVIDERS[provider].env;
  if (process.env[idVar] && process.env[secretVar]) return { clientId: process.env[idVar]!, clientSecret: process.env[secretVar]!, configId: process.env.META_LOGIN_CONFIG_ID, source: 'env' };
  const doc = await (await getSharedDb()).collection('apps').findOne({ _id: provider as any });
  if (!doc) return null;
  try { return { clientId: doc.clientId, configId: doc.configId || undefined, clientSecret: open<string>(doc.secret), source: 'studio' }; }
  catch { return null; }   // ENGINE_KEY changed: save the app again
}

export async function saveApp(provider: ProviderId, clientId: string, clientSecret: string, configId?: string) {
  await (await getSharedDb()).collection('apps').updateOne({ _id: provider as any },
    { $set: { clientId, configId: configId || null, secret: seal(clientSecret), updatedAt: new Date() } }, { upsert: true });
}

export type Connection = {
  _id: ProviderId; account: Record<string, any>; connectedAt: Date; updatedAt: Date;
  secret?: string; pending?: string; error?: string;
};

export async function getConnection(project: string, provider: ProviderId) {
  return (await getDb(project)).collection<Connection>('connections').findOne({ _id: provider });
}

export async function saveConnection(project: string, provider: ProviderId, account: Record<string, any>, secret: unknown) {
  await (await getDb(project)).collection<Connection>('connections').updateOne({ _id: provider }, {
    $set: { account, secret: seal(secret), updatedAt: new Date() }, $setOnInsert: { connectedAt: new Date() }, $unset: { pending: '', error: '' },
  }, { upsert: true });
}

/** The exact redirect URL to register in each developer app. */
export function redirectUri(provider: ProviderId, req: Request) {
  const base = (process.env.STUDIO_URL || new URL(req.url).origin).replace(/\/$/, '');
  return `${base}/api/oauth/${provider}/callback`;
}
export function studioBase(req: Request) {
  return (process.env.STUDIO_URL || new URL(req.url).origin).replace(/\/$/, '');
}

/** What the studio shows for a linked Meta Page (the token stays in the sealed secret). */
export const accountOf = (p: any) => ({ pageId: p.pageId, pageName: p.pageName, igUserId: p.igUserId, igUsername: p.igUsername, name: p.igUsername ? `@${p.igUsername}` : p.pageName });
