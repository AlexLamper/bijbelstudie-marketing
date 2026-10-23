// Renders every queued item of the project, uploads it and puts it up for review.
// When nothing is left in the queue for a week, Alex gets one message: "week ready to review".
import '../env.mjs';
import { renderSpec, launch } from '../render/render.mjs';
import { upload } from '../storage/index.mjs';
import { db, close, STATUS } from '../db.mjs';
import { notify, studioLink } from '../notify.mjs';
import { project } from '../project.mjs';

const d = await db(); const items = d.collection('items');
const queued = await items.find({ $or: [{ status: STATUS.QUEUED }, { status: STATUS.FAILED, media: { $exists: false }, renderAttempts: { $not: { $gte: 3 } } }] }).sort({ slot: 1 }).toArray();
const weeks = new Set(); const browser = await launch(); let ok = 0;

for (const it of queued) {
  await items.updateOne({ _id: it._id }, { $set: { status: STATUS.RENDERING }, $inc: { renderAttempts: 1 } });
  try {
    const r = await renderSpec(it.spec, { browser });
    const v = Date.now();                       // version suffix: re-renders never hit a stale cache
    const key = `${project().id}/items/${it._id}/${v}`;
    const media = { url: await upload(r.files.media, `${key}-${r.files.media.split('/').pop()}`), duration: r.duration };
    if (r.files.cover) media.coverUrl = await upload(r.files.cover, `${key}-cover.jpg`);
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.REVIEW, media, renderNotes: r.notes, renderedAt: new Date(), renderAttempts: 0 }, $unset: { error: '' },
      $push: { history: { at: new Date(), event: 'rendered' } } });
    weeks.add(it.week); ok++;
  } catch (e) {
    console.error(`${it._id}: ${e.message}`);
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.FAILED, error: e.message }, $push: { history: { at: new Date(), event: 'render-failed', note: e.message } } });
  }
}
await browser.close();

for (const week of weeks) {
  const left = await items.countDocuments({ week, status: { $in: [STATUS.QUEUED, STATUS.RENDERING] } });
  if (left) continue;
  const toReview = await items.countDocuments({ week, status: STATUS.REVIEW });
  if (toReview) await notify(`week ${week.split('-W')[1]} staat klaar (${toReview} items)`, [
    `${toReview} posts en reels wachten op je akkoord.`, 'Keur goed, wijs af of zet er een opmerking bij - de rest gaat vanzelf.'],
    studioLink(`/week/${week}`));
}
console.log(`[${project().id}] rendered ${ok}/${queued.length}`);
await close();
