// Renders every queued item of the project, uploads it and puts it up for review.
// When nothing is left in the queue for a day, Alex gets one message: "<day> ready to review".
import '../env.mjs';
import { renderSpec, launch } from '../render/render.mjs';
import { upload } from '../storage/index.mjs';
import { db, close, STATUS, heartbeat } from '../db.mjs';
import { notify, studioLink } from '../notify.mjs';
import { project } from '../project.mjs';
import { localDate } from '../days.mjs';

const d = await db(); const items = d.collection('items');
await (await import('../library.mjs')).loadVoices(d);     // voice test set for tts
// Several render jobs may run side by side (render.yml shards; 3D reels take minutes each): every job
// claims one item at a time atomically, so no item is rendered twice. A job stops claiming after
// RENDER_MINUTES (default 140) so it ends inside its time limit; the next run picks up the rest.
const WAITING = { $or: [{ status: STATUS.QUEUED }, { status: STATUS.FAILED, media: { $exists: false }, renderAttempts: { $not: { $gte: 3 } } }] };
const stopAt = Date.now() + Number(process.env.RENDER_MINUTES || 140) * 60e3;
const tz = project().timezone;
const days = new Map(); const browser = await launch(); let ok = 0, n = 0;   // local date -> week of the items rendered
const claim = async () => { const r = await items.findOneAndUpdate(WAITING, { $set: { status: STATUS.RENDERING, renderStartedAt: new Date() }, $inc: { renderAttempts: 1 } }, { sort: { slot: 1 }, returnDocument: 'after' }); return r?.value !== undefined && r?.ok !== undefined ? r.value : r; };

for (let it = await claim(); it; it = Date.now() < stopAt ? await claim() : null) {
  n++;
  try {
    const r = await renderSpec(it.spec, { browser });
    const v = Date.now();                       // version suffix: re-renders never hit a stale cache
    const key = `${project().id}/items/${it._id}/${v}`;
    const media = { url: await upload(r.files.media, `${key}-${r.files.media.split('/').pop()}`), duration: r.duration };
    if (r.files.slides) { media.slides = [media.url]; for (const f of r.files.slides.slice(1)) media.slides.push(await upload(f, `${key}-${f.split('/').pop()}`)); }
    if (r.files.cover) media.coverUrl = await upload(r.files.cover, `${key}-cover.jpg`);
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.REVIEW, media, renderNotes: r.notes, renderedAt: new Date(), renderAttempts: 0 }, $unset: { error: '' },
      $push: { history: { at: new Date(), event: 'rendered' } } });
    days.set(localDate(it.slot, tz), it.week); ok++;
  } catch (e) {
    console.error(`${it._id}: ${e.message}`);
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.FAILED, error: e.message }, $push: { history: { at: new Date(), event: 'render-failed', note: e.message } } });
  }
}
await browser.close();

// One message per day whose items are all rendered (the studio link opens that day's week).
const DAY = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });
for (const [date, week] of days) {
  const same = (await items.find({ week }, { projection: { slot: 1, status: 1 } }).toArray()).filter(x => localDate(x.slot, tz) === date);
  if (!same.length || same.some(x => [STATUS.QUEUED, STATUS.RENDERING].includes(x.status))) continue;
  const toReview = same.filter(x => x.status === STATUS.REVIEW).length;
  const label = DAY.format(same[0].slot);   // e.g. "dinsdag 10 november"
  if (toReview) await notify(`${label} staat klaar (${toReview} ${toReview === 1 ? 'item' : 'items'})`, [
    `${toReview === 1 ? '1 post of reel wacht' : `${toReview} posts en reels wachten`} op je akkoord.`, 'Keur goed, wijs af of zet er een opmerking bij - de rest gaat vanzelf.'],
    studioLink(`/week/${week}`), { replaces: `${label} staat klaar` });
}
console.log(`[${project().id}] rendered ${ok}/${n}${Date.now() >= stopAt ? ' (time limit - the rest goes in the next run)' : ''}`);
await heartbeat('render', { rendered: ok, of: n });
await close();
