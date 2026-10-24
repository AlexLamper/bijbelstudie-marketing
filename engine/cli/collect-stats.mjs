// Daily, per project: per-item metrics (Instagram, YouTube), account numbers, new product signups,
// new comments to draft replies for, (weekly) competitor snapshots, and cleanup: media of old posts,
// rejected items a day after the rejection.
import '../env.mjs';
import { db, close, STATUS, heartbeat } from '../db.mjs';
import { applyConnections } from '../connections.mjs';
import { metaConfigured, instagramInsights, facebookInsights, instagramAccount, instagramComments, businessDiscovery } from '../publish/meta.mjs';
import { tiktokConfigured, tiktokStats, tiktokAccount } from '../publish/tiktok.mjs';
import { youtubeConfigured, youtubeStats, youtubeRetention } from '../publish/youtube.mjs';
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
      const fb = it.results?.facebook; if (fb?.id && process.env.FB_PAGE_ID) { try { const f = await facebookInsights(fb, it.kind.startsWith('reel-')); if (f.views != null) await items.updateOne({ _id: it._id }, { $set: { 'metrics.facebook': { ...f, at: new Date() } } }); } catch (e) { console.error(`${it._id} facebook: ${e.message}`); } }
      await items.updateOne({ _id: it._id }, { $set: { 'metrics.instagram': { ...m, at: new Date() } } });
      for (const c of await instagramComments(ig)) {
        await d.collection('comments').updateOne({ _id: c.id }, { $setOnInsert: { ...c, itemId: it._id, platform: 'instagram', status: 'new', createdAt: new Date() } }, { upsert: true });
      }
    } catch (e) { console.error(`${it._id} insights: ${e.message}`); }
  }
  try { const a = await instagramAccount(); await d.collection('metrics').updateOne({ _id: today }, { $set: { instagram: a } }, { upsert: true }); } catch (e) { console.error(e.message); }

  // competitors: once a week (Monday) - the list from the studio (settings.competitors), else content/competitors.json
  const listFile = project().paths.competitors;
  const fromStudio = (await d.collection('settings').findOne({ _id: 'competitors' }))?.instagram;
  const competitors = fromStudio?.length ? fromStudio : existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')).instagram || [] : [];
  const lastSnap = await d.collection('insights').findOne({}, { sort: { at: -1 } });
  if (competitors.length && (new Date().getDay() === 1 || !lastSnap)) {
    for (const username of competitors) {
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
      let ret = {}; try { ret = await youtubeRetention(ids.slice(i, i + 50)); } catch (e) { if (i === 0) console.error(`${e.message} (watch time needs YouTube re-linked with the analytics permission)`); }
      for (const it of live) if (stats[it.results?.youtube?.id]) await items.updateOne({ _id: it._id }, { $set: { 'metrics.youtube': { ...stats[it.results.youtube.id], ...(ret[it.results.youtube.id] || {}), at: new Date() } } });
    } catch (e) { console.error(e.message); }
  }
}

// TikTok: only public videos have an id we can query (needs the video.list scope - Instellingen > TikTok > Opnieuw)
if (tiktokConfigured()) {
  try { await d.collection('metrics').updateOne({ _id: today }, { $set: { tiktok: await tiktokAccount() } }, { upsert: true }); } catch (e) { console.error(e.message); }
  const withId = live.filter(it => it.results?.tiktok?.id && !it.results.tiktok.needsManual && /^\d+$/.test(String(it.results.tiktok.id)));
  if (withId.length) {
    try {
      const stats = await tiktokStats(withId.map(it => String(it.results.tiktok.id)));
      for (const it of withId) { const m = stats[String(it.results.tiktok.id)]; if (m) await items.updateOne({ _id: it._id }, { $set: { 'metrics.tiktok': { ...m, at: new Date() } } }); }
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
// Keep storage small (Vercel Blob free tier): drop media of items published > 60 days ago.
const mediaUrls = it => [...new Set([it.media?.url, it.media?.coverUrl, ...(it.media?.slides || [])].filter(Boolean))];
if (storageConfigured()) {
  const old = await items.find({ media: { $exists: true }, status: { $in: [STATUS.PUBLISHED, STATUS.PARTIAL] }, publishedAt: { $lt: new Date(Date.now() - 60 * 864e5) } }).toArray();
  for (const it of old) {
    try { await remove(mediaUrls(it)); await items.updateOne({ _id: it._id }, { $unset: { media: '' }, $set: { mediaRemovedAt: new Date() } }); }
    catch (e) { console.error(`cleanup ${it._id}: ${e.message}`); }
  }
  if (old.length) console.log(`removed media of ${old.length} old items`);
}
// Rejected items go a day after Alex rejected them: the media from storage and the item from the studio.
// A short record stays in `rejected` (exported to content/context/rejected.json) so the planner learns
// what he does not want. Published items are never touched here.
{
  const { rejectedRecord, rejectedAt } = await import('../repeats.mjs');
  const dayAgo = Date.now() - 24 * 3600e3;
  const due = (await items.find({ status: STATUS.REJECTED }).toArray()).filter(it => new Date(rejectedAt(it) || Date.now()).getTime() < dayAgo);
  let gone = 0;
  for (const it of due) {
    const urls = mediaUrls(it);
    if (urls.length && !storageConfigured()) { console.error(`rejected ${it._id}: no media storage configured - item kept`); continue; }
    try {
      const { _id, ...record } = rejectedRecord(it);
      await d.collection('rejected').updateOne({ _id }, { $set: record }, { upsert: true });
      await remove(urls);
      if ((await items.deleteOne({ _id: it._id, status: STATUS.REJECTED })).deletedCount) gone++;
    } catch (e) { console.error(`rejected ${it._id}: ${e.message}`); }
  }
  if (gone) console.log(`removed ${gone} rejected items (media + item)`);
}
// Reminder (once a day): what waits for Alex's approval, and how full the pile of approved items is
// (every day the publish job takes the next ones from it; no dates).
const soon = await items.find({ status: { $in: [STATUS.REVIEW, STATUS.CHANGES] } }).toArray();
if (soon.length) {
  const { notify, studioLink } = await import('../notify.mjs');
  const pile = await items.countDocuments({ status: STATUS.APPROVED, postAt: null });
  const review = soon.filter(i => i.status === STATUS.REVIEW).length;
  await notify(`Wacht op je akkoord: ${review || soon.length} ${(review || soon.length) === 1 ? 'item' : 'items'}`, [
    pile ? `Op de stapel goedgekeurd: ${pile}. Wat je goedkeurt, komt erbij en gaat vanzelf online.` : 'De stapel goedgekeurde items is leeg: zonder goedkeuring gaat er niets online.',
    soon.some(i => i.status === STATUS.CHANGES) ? 'Een paar wachten op aanpassingen door Claude.' : 'Keur goed of wijs af in de studio.'],
    studioLink(''), { replaces: 'Wacht op je akkoord' });
}
// Experiments: fair score per item and platform, per trait value, for the studio and the planner.
try { const { updateBoard } = await import('../library.mjs'); const b = await updateBoard(d); console.log(`experiments: ${b.trials} trials from ${b.items} items`); }
catch (e) { console.error(`experiments: ${e.message}`); }
console.log(`[${project().id}] stats for ${live.length} live items, ${soon.length} waiting for approval`);
await heartbeat('stats', { live: live.length, waitingApproval: soon.length });
await close();
