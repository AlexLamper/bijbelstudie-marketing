// Daily, per project: per-item metrics (Instagram, YouTube), account numbers, new product signups,
// new comments to draft replies for, and (weekly) competitor snapshots.
import '../env.mjs';
import { db, close, STATUS, heartbeat } from '../db.mjs';
import { applyConnections } from '../connections.mjs';
import { metaConfigured, instagramInsights, instagramAccount, instagramComments, businessDiscovery } from '../publish/meta.mjs';
import { youtubeConfigured, youtubeStats } from '../publish/youtube.mjs';
import { MongoClient } from 'mongodb';
import { remove, storageConfigured } from '../storage/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';

const d = await db(); const items = d.collection('items');
await applyConnections();
const since = new Date(Date.now() - 30 * 864e5);
const live = await items.find({ status: { $in: [STATUS.PUBLISHED, STATUS.PARTIAL] }, publishedAt: { $gte: since } }).toArray();
const today = new Date().toISOString().slice(0, 10);

if (metaConfigured()) {
  for (const it of live) {
    const ig = it.results?.instagram?.id; if (!ig) continue;
    try {
      const m = await instagramInsights(ig, it.kind.startsWith('reel-'));
      await items.updateOne({ _id: it._id }, { $set: { 'metrics.instagram': { ...m, at: new Date() } } });
      for (const c of await instagramComments(ig)) {
        await d.collection('comments').updateOne({ _id: c.id }, { $setOnInsert: { ...c, itemId: it._id, platform: 'instagram', status: 'new', createdAt: new Date() } }, { upsert: true });
      }
    } catch (e) { console.error(`${it._id} insights: ${e.message}`); }
  }
  try { const a = await instagramAccount(); await d.collection('metrics').updateOne({ _id: today }, { $set: { instagram: a } }, { upsert: true }); } catch (e) { console.error(e.message); }

  // competitors: once a week (Monday), from projects/<id>/content/competitors.json
  const listFile = project().paths.competitors;
  if (new Date().getDay() === 1 && existsSync(listFile)) {
    for (const username of JSON.parse(readFileSync(listFile, 'utf8')).instagram) {
      try { const snap = await businessDiscovery(username); await d.collection('insights').insertOne({ username, at: new Date(), snap }); }
      catch (e) { console.error(`competitor ${username}: ${e.message}`); }
    }
  }
}

if (youtubeConfigured()) {
  const ids = live.map(it => it.results?.youtube?.id).filter(Boolean);
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const stats = await youtubeStats(ids.slice(i, i + 50));
      for (const it of live) if (stats[it.results?.youtube?.id]) await items.updateOne({ _id: it._id }, { $set: { 'metrics.youtube': { ...stats[it.results.youtube.id], at: new Date() } } });
    } catch (e) { console.error(e.message); }
  }
}

// The goal metric: new free users. Read-only count from the product's own database (PLATFORM_MONGODB_URI).
if (process.env.PLATFORM_MONGODB_URI) {
  const c = await new MongoClient(process.env.PLATFORM_MONGODB_URI).connect();
  try {
    const users = c.db(process.env.PLATFORM_MONGODB_DB || undefined).collection('users');
    const start = new Date(today), end = new Date(start.getTime() + 864e5), yStart = new Date(start.getTime() - 864e5);
    const [total, yesterday] = await Promise.all([users.estimatedDocumentCount(), users.countDocuments({ createdAt: { $gte: yStart, $lt: start } })]);
    await d.collection('metrics').updateOne({ _id: today }, { $set: { users: { total, newYesterday: yesterday } } }, { upsert: true });
  } finally { await c.close(); }
}
// Keep storage small (Vercel Blob free tier): drop media of items published > 60 days ago or rejected > 14 days ago.
if (storageConfigured()) {
  const old = await items.find({ media: { $exists: true }, $or: [
    { status: { $in: [STATUS.PUBLISHED, STATUS.PARTIAL] }, publishedAt: { $lt: new Date(Date.now() - 60 * 864e5) } },
    { status: STATUS.REJECTED, updatedAt: { $lt: new Date(Date.now() - 14 * 864e5) } }] }).toArray();
  for (const it of old) {
    try { await remove([it.media.url, it.media.coverUrl]); await items.updateOne({ _id: it._id }, { $unset: { media: '' }, $set: { mediaRemovedAt: new Date() } }); }
    catch (e) { console.error(`cleanup ${it._id}: ${e.message}`); }
  }
  if (old.length) console.log(`removed media of ${old.length} old items`);
}
// Reminder: posts planned for the next 36 hours that still wait for Alex's approval (once a day).
const soon = await items.find({ status: { $in: [STATUS.REVIEW, STATUS.CHANGES] }, slot: { $gte: new Date(), $lte: new Date(Date.now() + 36 * 3600e3) } }).sort({ slot: 1 }).toArray();
if (soon.length) {
  const { notify, studioLink } = await import('../notify.mjs');
  const first = soon[0]; const when = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', hour: '2-digit', minute: '2-digit', timeZone: project().timezone }).format(first.slot);
  await notify(`${soon.length} posts wachten nog op je akkoord`, [
    `De eerste staat gepland voor ${when}. Niet goedgekeurd = niet geplaatst.`,
    soon.some(i => i.status === STATUS.CHANGES) ? 'Een paar wachten op aanpassingen door Claude.' : 'Keur ze goed in de studio (of "Alles goedkeuren").'],
    studioLink(`/week/${first.week}`), { replaces: 'posts wachten nog' });
}
console.log(`[${project().id}] stats for ${live.length} live items, ${soon.length} waiting for approval`);
await heartbeat('stats', { live: live.length, waitingApproval: soon.length });
await close();
