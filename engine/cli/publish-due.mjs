// Runs every hour, per project. First, every posting time that is open now (engine/slots.mjs) takes the
// next item of its type from the pile of approved items (approved longest ago first) - Alex approves
// without dates, the pile is the schedule. Then it publishes the items whose time has come, platform by
// platform. Only approved items are ever touched. A platform that fails is retried next run (max 3x);
// platforms that succeeded are never posted twice. A platform that is not linked yet is waited for
// (link it on the studio's Instellingen page) for up to a day, then skipped.
import '../env.mjs';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db, close, STATUS, heartbeat } from '../db.mjs';
import { applyConnections } from '../connections.mjs';
import { metaConfigured, publishInstagram, publishFacebook } from '../publish/meta.mjs';
import { youtubeConfigured, publishYouTube } from '../publish/youtube.mjs';
import { tiktokConfigured, uploadPostConfigured, publishTikTok } from '../publish/tiktok.mjs';
import { notify, studioLink } from '../notify.mjs';
import { project } from '../project.mjs';
import { openTimes, slotGroup, approvedAt, localDay, postPlatforms } from '../slots.mjs';

const PUBLISHERS = {
  instagram: { ok: metaConfigured, run: publishInstagram, label: 'Instagram' },
  facebook: { ok: () => !!(process.env.META_PAGE_TOKEN && process.env.FB_PAGE_ID), run: publishFacebook, label: 'Facebook' },
  youtube: { ok: youtubeConfigured, run: publishYouTube, label: 'YouTube' },
  tiktok: { ok: () => tiktokConfigured() || uploadPostConfigured(), run: publishTikTok, label: 'TikTok' },
};
const MAX_TRIES = 3;
const WAIT_FOR_LINK_MS = 24 * 3600e3;

const d = await db();
const items = d.collection('items');
const linked = await applyConnections();          // accounts linked in the studio
// The pile: an open posting time takes the next approved item of its type that has no time yet.
const tz = project().timezone || 'Europe/Amsterdam'; const now = new Date();
const open = openTimes({ now, tz });
if (open.length) {
  const used = new Set((await items.find({ postAt: { $in: open.map(t => t.at) } }, { projection: { postAt: 1 } }).toArray()).map(o => +new Date(o.postAt)));
  const pile = (await items.find({ status: STATUS.APPROVED, postAt: null }).toArray()).sort((a, b) => approvedAt(a) - approvedAt(b));
  for (const t of open.filter(t => !used.has(+t.at))) {
    const i = pile.findIndex(it => slotGroup(it.kind) === t.group); if (i < 0) continue;
    const [it] = pile.splice(i, 1);
    const r = await items.updateOne({ _id: it._id, status: STATUS.APPROVED, postAt: null }, {
      $set: { postAt: t.at, slot: t.at, 'spec.slot': t.iso, week: t.week, 'spec.week': t.week, plannedSlot: it.plannedSlot || it.slot,
        'spec.platforms': postPlatforms(it.kind, project().platforms) },   // reels everywhere, the verse on instagram/facebook (Alex, 24 Oct)
      $push: { history: { at: now, event: 'scheduled', note: `${localDay(t.at, tz)} ${t.time}` } } });
    if (r.modifiedCount) console.log(`[${project().id}] ${it._id}: from the pile for ${t.time}`);
  }
}
const due = await items.find({ $or: [{ status: STATUS.PARTIAL }, { status: STATUS.APPROVED, postAt: { $lte: now } }] }).sort({ postAt: 1, slot: 1 }).toArray();
const tmp = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'pub-'));
const problems = []; const waiting = new Set(); const tiktokPrivate = [];

for (const it of due) {
  it.results ??= {};
  const late = Date.now() - new Date(it.slot).getTime();
  const todo = it.spec.platforms.filter(pl => { const r = it.results[pl]; return !r?.id && !r?.skipped && (r?.tries || 0) < MAX_TRIES; });

  // not linked yet: wait (up to a day), then give up on that platform
  for (const pl of todo.filter(pl => !PUBLISHERS[pl].ok())) {
    if (late > WAIT_FOR_LINK_MS) it.results[pl] = { skipped: 'niet gekoppeld', at: new Date() };
    else { it.results[pl] = { waiting: 'niet gekoppeld' }; waiting.add(PUBLISHERS[pl].label); }
  }
  const ready = todo.filter(pl => PUBLISHERS[pl].ok());

  // YouTube/TikTok upload the bytes, so fetch the rendered file once
  if (ready.some(pl => pl === 'youtube' || pl === 'tiktok') && it.media?.url) {
    const f = join(tmp, `${it._id}.mp4`);
    writeFileSync(f, Buffer.from(await (await fetch(it.media.url)).arrayBuffer()));
    it.media.file = f;
  }
  // remember a platform's in-flight state (e.g. the Instagram container) before the irreversible step
  it.checkpoint = async (pl, data) => { it.results[pl] = { ...(it.results[pl] || {}), ...data }; await items.updateOne({ _id: it._id }, { $set: { [`results.${pl}`]: it.results[pl] } }); };
  for (const pl of ready) {
    const before = it.results[pl];
    try {
      it.results[pl] = { ...(await PUBLISHERS[pl].run(it)), at: new Date() };   // replaces any container checkpoint
      if (it.results[pl].needsManual) { if (pl === 'youtube') problems.push(`${it._id}: YouTube heeft de video als ${it.results[pl].privacy} geplaatst. Zet hem op openbaar in YouTube Studio: ${it.results[pl].url}`); else tiktokPrivate.push(it._id); }
    } catch (e) {
      const tries = (before?.tries || 0) + 1;
      it.results[pl] = { ...(it.results[pl]?.container ? { container: it.results[pl].container } : {}), error: e.message, tries, at: new Date() };
      if (tries >= MAX_TRIES) problems.push(`${it._id} op ${PUBLISHERS[pl].label}: ${e.message}`);
    }
  }

  const states = it.spec.platforms.map(pl => it.results[pl]);
  const allDone = states.every(r => r?.id || r?.skipped || (r?.tries || 0) >= MAX_TRIES);
  const anyOk = states.some(r => r?.id);
  const status = !allDone ? (anyOk ? STATUS.PARTIAL : STATUS.APPROVED)
    : anyOk ? (states.every(r => r?.id || r?.skipped) ? STATUS.PUBLISHED : STATUS.PARTIAL) : STATUS.FAILED;
  if (it.media) delete it.media.file;
  delete it.checkpoint;
  const update = { $set: { results: it.results, status, ...(anyOk && !it.publishedAt ? { publishedAt: new Date() } : {}) } };
  if (status !== it.status || ready.length) update.$push = { history: { at: new Date(), event: `publish:${status}` } };
  await items.updateOne({ _id: it._id }, update);
  if (anyOk && it.spec.verse?.ref) await d.collection('verses').updateOne({ _id: it.spec.verse.ref }, { $set: { ref: it.spec.verse.ref, itemId: it._id, at: new Date() } }, { upsert: true });
  console.log(`[${project().id}] ${it._id}: ${status} ${JSON.stringify(Object.fromEntries(Object.entries(it.results).map(([k, v]) => [k, v.id ? 'ok' : v.skipped || v.waiting || v.error])))}`);
}
rmSync(tmp, { recursive: true, force: true });

if (problems.length) await notify('Iets ging mis bij publiceren', problems, studioLink('/settings'));
// TikTok keeps posts private until it approves the app: one note a day, not one per video
if (tiktokPrivate.length) {
  const key = `tiktok-private:${new Date().toISOString().slice(0, 10)}`;
  const first = await d.collection('settings').updateOne({ _id: key }, { $setOnInsert: { at: new Date() } }, { upsert: true });
  if (first.upsertedCount) await notify('TikTok-video\'s staan nog privé', [
    'TikTok plaatst video\'s van nog niet goedgekeurde apps alleen privé. Ze staan op je TikTok-account; zet ze daar op openbaar als je wilt.',
    'Na goedkeuring van de app (of via Upload-Post) gaan ze vanzelf openbaar.'], studioLink('/settings'), { replaces: 'TikTok-video' });
}
// one reminder a day while approved posts wait for an account that is not linked
if (waiting.size) {
  const key = `waiting:${new Date().toISOString().slice(0, 10)}`;
  const first = await d.collection('settings').updateOne({ _id: key }, { $setOnInsert: { at: new Date() } }, { upsert: true });
  if (first.upsertedCount) await notify(`posts wachten op ${[...waiting].join(', ')}`, [
    `Goedgekeurde posts zijn klaar om te plaatsen, maar ${[...waiting].join(', ')} is nog niet gekoppeld.`,
    'Koppel het op de pagina Instellingen; ze gaan dan bij de volgende run (binnen 30 minuten) alsnog online. Na 24 uur wachten wordt dat platform voor die post overgeslagen.'], studioLink('/settings'), { replaces: 'posts wachten op' });
}
await heartbeat('publish', { due: due.length, waiting: waiting.size ? [...waiting].join('+') : 0, problems: problems.length, linked: Object.keys(linked).join('+') || '-' });
await close();
