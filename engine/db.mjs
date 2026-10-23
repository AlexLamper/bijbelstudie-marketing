// MongoDB access for the engine scripts (the studio has its own copy in lib/mongo.ts).
// One cluster (MONGODB_URI), one database per project (project.json "db").
// Collections:
//   items     one row per post/reel: spec, status, media, per-platform results, metrics
//   tokens    OAuth tokens that rotate (TikTok, YouTube) - never in git
//   verses    every verse that went out (the never-reuse ledger)
//   metrics   daily account numbers (followers, signups)
//   insights  competitor snapshots from Instagram Business Discovery
//   reports   weekly reports written by the planner
//   comments  incoming comments + drafted replies
import { MongoClient } from 'mongodb';
import { project } from './project.mjs';

let client;
export async function db() {
  if (!process.env.MONGODB_URI) {
    console.log('MONGODB_URI is not set (add it as a GitHub Actions secret) - nothing to do, skipping.');
    process.exit(0);
  }
  if (!client) {
    client = await new MongoClient(process.env.MONGODB_URI).connect();
    await loadStudioSecrets(client);
  }
  return client.db(project().db);
}

/** Keys pasted on the studio's Instellingen page (sealed in Mongo). GitHub secrets and env win. */
async function loadStudioSecrets(c) {
  if (!process.env.ENGINE_KEY) return;
  try {
    const { open } = await import('./crypto.mjs');
    const shared = await c.db(process.env.STUDIO_DB || 'marketing_studio').collection('secrets').find().toArray();
    const own = await c.db(project().db).collection('secrets').find().toArray();
    const names = [];
    for (const d of [...shared, ...own]) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(d._id)) continue;
      names.push(d._id);
      if (process.env[d._id]) continue;
      try { process.env[d._id] = open(d.value); } catch { console.error(`studio key ${d._id} could not be read (ENGINE_KEY changed?)`); }
    }
    globalThis.__studioKeyNames = names.sort();
  } catch (e) { console.error(`studio keys: ${e.message}`); }
}
export async function close() { await client?.close(); client = undefined; }

// Item lifecycle
export const STATUS = {
  QUEUED: 'queued',          // spec imported, waiting for render
  RENDERING: 'rendering',
  REVIEW: 'review',          // rendered, waiting for Alex
  CHANGES: 'changes',        // Alex commented; the planner revises it, then it renders again
  APPROVED: 'approved',      // will go out at its slot
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  PARTIAL: 'partial',        // some platforms failed
  FAILED: 'failed',
};

/** Last run of each job, shown on the studio's Instellingen page (names of secrets only, never values). */
export async function heartbeat(job, summary = {}) {
  try {
    const { ttsProvider } = await import('./tts/index.mjs');
    const { storageProvider } = await import('./storage/index.mjs');
    const configured = {
      meta: !!(process.env.META_PAGE_TOKEN && process.env.IG_USER_ID), facebook: !!(process.env.META_PAGE_TOKEN && process.env.FB_PAGE_ID),
      youtube: !!(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN),
      tiktok: !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET) || !!process.env.UPLOADPOST_API_KEY,
      tts: ttsProvider(), storage: storageProvider(), platformDb: !!process.env.PLATFORM_MONGODB_URI,
      notify: process.env.RESEND_API_KEY && process.env.NOTIFY_TO ? 'email' : 'github',
    };
    await (await db()).collection('runs').updateOne({ _id: job }, { $set: {
      at: new Date(), ok: true, summary, configured, secrets: globalThis.__secretNames || [], studioKeys: globalThis.__studioKeyNames || [],
      run: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : 'local',
    } }, { upsert: true });
  } catch (e) { console.error(`heartbeat: ${e.message}`); }
}

// OAuth tokens that rotate (TikTok) - in `connections` (sealed, linked from the studio) or legacy `tokens`.
export async function getToken(name) {
  const { open } = await import('./crypto.mjs');
  const c = await (await db()).collection('connections').findOne({ _id: name, secret: { $exists: true } });
  if (c) { try { return open(c.secret); } catch { return null; } }
  return (await db()).collection('tokens').findOne({ _id: name });
}
export async function saveToken(name, data) {
  const { seal } = await import('./crypto.mjs');
  const c = await (await db()).collection('connections').findOne({ _id: name });
  if (c) return (await db()).collection('connections').updateOne({ _id: name }, { $set: { secret: seal(data), updatedAt: new Date() } });
  await (await db()).collection('tokens').updateOne({ _id: name }, { $set: { ...data, updatedAt: new Date() } }, { upsert: true });
}
