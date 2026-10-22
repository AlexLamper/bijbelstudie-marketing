// Renders every queued item, uploads it to R2 and puts it up for review.
// When nothing is left in the queue for a week, Alex gets one email: "week ready to review".
import { renderSpec, launch } from '../render/render.mjs';
import { upload } from '../storage/r2.mjs';
import { db, close, STATUS } from '../db.mjs';
import { notify } from '../notify.mjs';

const d = await db(); const items = d.collection('items');
const queued = await items.find({ status: STATUS.QUEUED }).sort({ slot: 1 }).toArray();
const weeks = new Set(); const browser = await launch(); let ok = 0;

for (const it of queued) {
  await items.updateOne({ _id: it._id }, { $set: { status: STATUS.RENDERING } });
  try {
    const r = await renderSpec(it.spec, { browser });
    const v = Date.now();                       // version suffix: re-renders never hit a stale cache
    const media = { url: await upload(r.files.media, `items/${it._id}/${v}-${r.files.media.split('/').pop()}`), duration: r.duration };
    if (r.files.cover) media.coverUrl = await upload(r.files.cover, `items/${it._id}/${v}-cover.jpg`);
    await items.updateOne({ _id: it._id }, { $set: { status: STATUS.REVIEW, media, renderNotes: r.notes, renderedAt: new Date() },
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
  if (toReview) await notify(`Week ${week} staat klaar (${toReview} items)`, [
    `${toReview} posts en reels wachten op je akkoord.`, 'Keur goed, wijs af of zet er een opmerking bij - de rest gaat vanzelf.'],
    process.env.DASHBOARD_URL && `${process.env.DASHBOARD_URL}/week/${week}`);
}
console.log(`rendered ${ok}/${queued.length}`);
await close();
