// Renders every queued item of the project, uploads it and puts it up for review.
// When nothing is left to render, Alex gets one message: how many items wait for his review.
import '../env.mjs';
import { renderSpec, launch } from '../render/render.mjs';
import { upload, remove } from '../storage/index.mjs';
import { synthesize, resolveVoice } from '../tts/index.mjs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db, close, STATUS, heartbeat } from '../db.mjs';
import { notify, studioLink } from '../notify.mjs';
import { project } from '../project.mjs';

const d = await db(); const items = d.collection('items');
await (await import('../library.mjs')).loadVoices(d);     // voice test set for tts
// Several render jobs may run side by side (render.yml shards; 3D reels take minutes each): every job
// claims one item at a time atomically, so no item is rendered twice. A job stops claiming after
// RENDER_MINUTES (default 140) so it ends inside its time limit; the next run picks up the rest.
// a failed item is tried again (at most 3 times in a row), also when it still has an older video - e.g. a
// rewritten item (Revise, Learn) whose new render failed once
// An item still "rendering" long after any job could be on it (render.yml stops a job at 160 min) was cut
// off by that limit: it is picked up again, so it never stays stuck.
const STALE_MIN = 170;
const WAITING = () => ({ $or: [{ status: STATUS.QUEUED }, { status: STATUS.FAILED, renderAttempts: { $not: { $gte: 3 } } },
  { status: STATUS.RENDERING, renderStartedAt: { $lt: new Date(Date.now() - STALE_MIN * 60e3) } }] });
const stopAt = Date.now() + Number(process.env.RENDER_MINUTES || 140) * 60e3;
// A map story takes long (about 3 s a frame, 60-90 min): with less time left a job takes other items first,
// so it is not cut off halfway (the next run takes the story).
const LONG = { 'reel-story': 95 };
const claimable = () => { const left = (stopAt - Date.now()) / 60e3 + 20; const skip = Object.entries(LONG).filter(([, m]) => left < m).map(([k]) => k);
  return skip.length ? { $and: [WAITING(), { kind: { $nin: skip } }] } : WAITING(); };
// 25 Oct: a long render run on older code claimed the videos the Engine fix had just queued (watermark, calmer
// pace) and made them without the fix; the run the fix started then found nothing. So before every claim a job
// on GitHub checks main: when it has newer code for what a video looks or sounds like, this job stops claiming
// and the waiting render run (or the next hourly kick) makes the rest with that code.
const RENDER_CODE = /^(engine\/|assets\/|data\/|projects\/[^/]+\/(assets\/|project\.json|brand\/pronunciation\.json))/;
let staleAt = 0, stale = false;
function codeIsStale() {
  if (!process.env.GITHUB_ACTIONS || stale || Date.now() - staleAt < 60e3) return stale;
  staleAt = Date.now();
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
    const main = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { timeout: 20e3 }).toString().split(/\s/)[0];
    if (!main || main === head) return false;
    execFileSync('git', ['fetch', '-q', '--depth=1', 'origin', 'refs/heads/main'], { timeout: 60e3 });
    const changed = execFileSync('git', ['diff', '--name-only', head, 'FETCH_HEAD']).toString().split('\n').filter(f => RENDER_CODE.test(f));
    if (changed.length) { stale = true; console.log(`[${project().id}] main has newer render code (${main.slice(0, 7)}: ${changed.slice(0, 3).join(', ')}${changed.length > 3 ? ', ...' : ''}) - this job stops claiming, the next render run makes the rest`); }
  } catch (e) { console.error(`code check: ${e.message.split('\n')[0]}`); }
  return stale;
}
// Storage first: when media cannot be stored (24 Oct: the Blob store was suspended over its limit), rendering
// would only throw the work away. Then nothing is claimed, the items stay queued, and the run fails visibly.
if (await items.countDocuments(WAITING())) {
  try { const f = join(tmpdir(), `probe-${Date.now()}.txt`); writeFileSync(f, 'probe'); await remove([await upload(f, `${project().id}/probe/${Date.now()}.txt`)]); }
  catch (e) {
    console.error(`[${project().id}] media storage does not work (${e.message}) - nothing rendered, the items stay queued`);
    await heartbeat('render', { rendered: 0, of: 0, error: `opslag: ${e.message}` }); await close(); process.exit(1);
  }
}
// Voice takes are kept (Mongo voicecache + the mp3 in storage): rendering an item again after a change to
// the picture or the mix reuses the same take - no voice credits, and the voice stays exactly the same.
const cache = d.collection('voicecache');
async function say(text, voice, opts = {}) {
  const v = resolveVoice(voice);
  const key = createHash('sha256').update(JSON.stringify({ text, provider: v.provider, id: v.id, opts })).digest('hex').slice(0, 32);
  const hit = await cache.findOne({ _id: key });
  if (hit?.url) {
    try { const r = await fetch(hit.url); if (r.ok) { await cache.updateOne({ _id: key }, { $set: { usedAt: new Date() } }); return { audio: Buffer.from(await r.arrayBuffer()), alignment: hit.alignment || null, cached: true }; } }
    catch { /* not there any more: voice it again */ }
  }
  const out = await synthesize(text, voice, opts);
  try {
    const f = join(tmpdir(), `voice-${key}.mp3`); writeFileSync(f, out.audio);
    const url = await upload(f, `${project().id}/voice/${key}.mp3`);
    await cache.updateOne({ _id: key }, { $set: { url, alignment: out.alignment || null, chars: text.length, at: new Date(), usedAt: new Date() } }, { upsert: true });
  } catch (e) { console.error(`voice cache: ${e.message}`); }
  return out;
}
const browser = await launch(); let ok = 0, n = 0;
const claim = async () => { const r = await items.findOneAndUpdate(claimable(), { $set: { status: STATUS.RENDERING, renderStartedAt: new Date() }, $inc: { renderAttempts: 1 } }, { sort: { slot: 1 }, returnDocument: 'after' }); return r?.value !== undefined && r?.ok !== undefined ? r.value : r; };

for (let it = codeIsStale() ? null : await claim(); it; it = Date.now() < stopAt && !codeIsStale() ? await claim() : null) {
  n++;
  try {
    const r = await renderSpec(it.spec, { browser, say });
    const v = Date.now();                       // version suffix: re-renders never hit a stale cache
    const key = `${project().id}/items/${it._id}/${v}`;
    const media = { url: await upload(r.files.media, `${key}-${r.files.media.split('/').pop()}`), duration: r.duration };
    if (r.files.slides) { media.slides = [media.url]; for (const f of r.files.slides.slice(1)) media.slides.push(await upload(f, `${key}-${f.split('/').pop()}`)); }
    if (r.files.cover) media.coverUrl = await upload(r.files.cover, `${key}-cover.jpg`);
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.REVIEW, media, renderNotes: r.notes, renderedAt: new Date(), renderAttempts: 0 }, $unset: { error: '' },
      $push: { history: { at: new Date(), event: 'rendered' } } });
    ok++;
  } catch (e) {
    console.error(`${it._id}: ${e.message}`);
    for (const f of e.takes || []) {   // a take that kept failing the voice checks: stored to listen to
      try { console.error(`  take: ${await upload(f, `${project().id}/debug/${it._id}/${Date.now()}-${f.split('/').pop()}`)}`); } catch (u) { console.error(`  take not stored: ${u.message}`); }
    }
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.FAILED, error: e.message }, $push: { history: { at: new Date(), event: 'render-failed', note: e.message } } });
  }
}
await browser.close();

// One message when this batch is done (no dates: approved items go on the pile).
if (ok && !(await items.countDocuments({ status: { $in: [STATUS.QUEUED, STATUS.RENDERING] } }))) {
  const toReview = await items.countDocuments({ status: STATUS.REVIEW });
  if (toReview) await notify(`Klaar om te keuren: ${toReview} ${toReview === 1 ? 'item' : 'items'}`, [
    `${toReview === 1 ? '1 post of reel wacht' : `${toReview} posts en reels wachten`} op je akkoord.`, 'Wat je goedkeurt, gaat op de stapel en vanzelf online. Afwijzen of een opmerking kan ook.'],
    studioLink(''), { replaces: 'Klaar om te keuren' });
}
console.log(`[${project().id}] rendered ${ok}/${n}${Date.now() >= stopAt ? ' (time limit - the rest goes in the next run)' : ''}`);
await heartbeat('render', { rendered: ok, of: n });
await close();
