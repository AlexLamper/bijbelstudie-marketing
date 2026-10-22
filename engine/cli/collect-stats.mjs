// Daily: per-item metrics (Instagram, YouTube), account numbers, new BijbelStudie signups,
// new comments to draft replies for, and (weekly) competitor snapshots.
import { db, close, STATUS } from '../db.mjs';
import { metaConfigured, instagramInsights, instagramAccount, instagramComments, businessDiscovery } from '../publish/meta.mjs';
import { youtubeConfigured, youtubeStats } from '../publish/youtube.mjs';
import { MongoClient } from 'mongodb';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.mjs';

const d = await db(); const items = d.collection('items');
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

  // competitors: once a week (Monday), from content/competitors.json
  const listFile = join(ROOT, 'content', 'competitors.json');
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

// The goal metric: new free users. Read-only count from the BijbelStudie platform database.
if (process.env.PLATFORM_MONGODB_URI) {
  const c = await new MongoClient(process.env.PLATFORM_MONGODB_URI).connect();
  try {
    const users = c.db(process.env.PLATFORM_MONGODB_DB || undefined).collection('users');
    const start = new Date(today), end = new Date(start.getTime() + 864e5), yStart = new Date(start.getTime() - 864e5);
    const [total, yesterday] = await Promise.all([users.estimatedDocumentCount(), users.countDocuments({ createdAt: { $gte: yStart, $lt: start } })]);
    await d.collection('metrics').updateOne({ _id: today }, { $set: { users: { total, newYesterday: yesterday } } }, { upsert: true });
  } finally { await c.close(); }
}
console.log(`stats for ${live.length} live items`);
await close();
