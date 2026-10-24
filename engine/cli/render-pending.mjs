// Renders every queued item of the project, uploads it and puts it up for review.
// When nothing is left to render, Alex gets one message: how many items wait for his review.
import '../env.mjs';
import { renderSpec, launch } from '../render/render.mjs';
import { upload, remove } from '../storage/index.mjs';
import { synthesize, resolveVoice } from '../tts/index.mjs';
import { createHash } from 'node:crypto';
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
const WAITING = { $or: [{ status: STATUS.QUEUED }, { status: STATUS.FAILED, renderAttempts: { $not: { $gte: 3 } } }] };
const stopAt = Date.now() + Number(process.env.RENDER_MINUTES || 140) * 60e3;
// Storage first: when media cannot be stored (24 Oct: the Blob store was suspended over its limit), rendering
// would only throw the work away. Then nothing is claimed, the items stay queued, and the run fails visibly.
if (await items.countDocuments(WAITING)) {
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
const claim = async () => { const r = await items.findOneAndUpdate(WAITING, { $set: { status: STATUS.RENDERING, renderStartedAt: new Date() }, $inc: { renderAttempts: 1 } }, { sort: { slot: 1 }, returnDocument: 'after' }); return r?.value !== undefined && r?.ok !== undefined ? r.value : r; };

for (let it = await claim(); it; it = Date.now() < stopAt ? await claim() : null) {
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
