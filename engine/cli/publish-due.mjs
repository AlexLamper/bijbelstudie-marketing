// Runs every 15 minutes: publishes APPROVED items whose slot has passed, platform by platform.
// Only approved items are ever touched. A platform that fails is retried next run (max 3x);
// platforms that succeeded are never posted twice.
import '../env.mjs';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db, close, STATUS, heartbeat } from '../db.mjs';
import { applyConnections } from '../connections.mjs';
import { metaConfigured, publishInstagram, publishFacebook } from '../publish/meta.mjs';
import { youtubeConfigured, publishYouTube } from '../publish/youtube.mjs';
import { tiktokConfigured, uploadPostConfigured, publishTikTok } from '../publish/tiktok.mjs';
import { notify } from '../notify.mjs';

const PUBLISHERS = {
  instagram: { ok: metaConfigured, run: publishInstagram },
  facebook: { ok: () => metaConfigured() && !!process.env.FB_PAGE_ID, run: publishFacebook },
  youtube: { ok: youtubeConfigured, run: publishYouTube },
  tiktok: { ok: () => tiktokConfigured() || uploadPostConfigured(), run: publishTikTok },
};
const MAX_TRIES = 3;
const d = await db();
await applyConnections();                    // accounts linked in the studio const items = d.collection('items');
const due = await items.find({ status: { $in: [STATUS.APPROVED, STATUS.PARTIAL] }, slot: { $lte: new Date() } }).toArray();
const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'pub-'));
const problems = [];

for (const it of due) {
  it.results ??= {};
  // YouTube/TikTok upload the bytes, so fetch the rendered file once
  if (it.spec.kind.startsWith('reel-')) {
    const f = join(tmp, `${it._id}.mp4`);
    writeFileSync(f, Buffer.from(await (await fetch(it.media.url)).arrayBuffer()));
    it.media.file = f;
  }
  for (const platform of it.spec.platforms) {
    const done = it.results[platform];
    if (done?.id || (done?.tries || 0) >= MAX_TRIES) continue;
    const p = PUBLISHERS[platform];
    if (!p.ok()) { it.results[platform] = { skipped: 'not configured' }; continue; }
    try {
      it.results[platform] = { ...(await p.run(it)), at: new Date() };
      if (it.results[platform].needsManual) problems.push(`${it._id}: TikTok is nog niet goedgekeurd - de video staat privé, post hem handmatig vanuit de studio.`);
    } catch (e) {
      it.results[platform] = { error: e.message, tries: (done?.tries || 0) + 1, at: new Date() };
      if (it.results[platform].tries >= MAX_TRIES) problems.push(`${it._id} op ${platform}: ${e.message}`);
    }
  }
  const states = it.spec.platforms.map(pl => it.results[pl]);
  const allDone = states.every(r => r?.id || r?.skipped || (r?.tries || 0) >= MAX_TRIES);
  const anyOk = states.some(r => r?.id);
  const status = !allDone ? STATUS.PARTIAL : anyOk ? (states.every(r => r?.id || r?.skipped) ? STATUS.PUBLISHED : STATUS.PARTIAL) : STATUS.FAILED;
  delete it.media.file;
  await items.updateOne({ _id: it._id }, { $set: { results: it.results, status, publishedAt: anyOk ? new Date() : null },
    $push: { history: { at: new Date(), event: `publish:${status}` } } });
  if (anyOk && it.spec.verse) await d.collection('verses').updateOne({ _id: it.spec.verse.ref }, { $set: { ref: it.spec.verse.ref, itemId: it._id, at: new Date() } }, { upsert: true });
  console.log(`${it._id}: ${status} ${JSON.stringify(Object.fromEntries(Object.entries(it.results).map(([k, v]) => [k, v.id ? 'ok' : v.skipped || v.error])))}`);
}
rmSync(tmp, { recursive: true, force: true });
if (problems.length) await notify('Iets ging mis bij publiceren', problems);
await heartbeat('publish', { due: due.length, problems: problems.length });
await close();
