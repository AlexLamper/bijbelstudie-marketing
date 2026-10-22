// Imports what the planner (Claude) wrote into content/queue/ :
//   *.json        item specs  -> items (status queued)
//   report-*.md   weekly report -> reports
//   replies.json  drafted comment replies -> comments
// Invalid specs are not imported; their errors go to content/queue/_errors.json so the
// planner's next run (or a revise run) can fix them.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.mjs';
import { prepare } from '../spec.mjs';
import { isUsed } from '../verses.mjs';
import { db, close, STATUS } from '../db.mjs';

const Q = join(ROOT, 'content', 'queue');
const DONE = join(ROOT, 'content', 'imported');
mkdirSync(DONE, { recursive: true });
const d = await db();
const used = (await d.collection('verses').find().toArray()).map(v => v.ref);
const errors = []; let n = 0;

for (const f of existsSync(Q) ? readdirSync(Q) : []) {
  const p = join(Q, f);
  try {
    if (f.endsWith('.json') && !f.startsWith('_') && f !== 'replies.json') {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      const spec = await prepare(raw);
      if (spec.ref && isUsed(spec.ref, used)) throw new Error(`Verse ${spec.ref} was already posted - pick another`);
      const existing = await d.collection('items').findOne({ _id: spec.id });
      if (existing && ![STATUS.CHANGES, STATUS.QUEUED, STATUS.REVIEW].includes(existing.status)) throw new Error(`Item ${spec.id} is already ${existing.status}`);
      const aiLabel = spec.kind === 'reel-explainer';           // AI voice -> platform AI label
      await d.collection('items').updateOne({ _id: spec.id }, {
        $set: { spec, kind: spec.kind, week: spec.week, slot: new Date(spec.slot), status: STATUS.QUEUED, aiLabel, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date(), history: [] },
      }, { upsert: true });
      n++;
    } else if (/^report-.*\.md$/.test(f)) {
      const week = f.slice(7, -3);
      await d.collection('reports').updateOne({ _id: week }, { $set: { week, markdown: readFileSync(p, 'utf8'), createdAt: new Date() } }, { upsert: true });
    } else if (f === 'replies.json') {
      for (const r of JSON.parse(readFileSync(p, 'utf8'))) {
        await d.collection('comments').updateOne({ _id: r.commentId }, { $set: { draft: r.reply, draftedAt: new Date() } });
      }
    } else continue;
    renameSync(p, join(DONE, `${Date.now()}-${f}`));
  } catch (e) { errors.push({ file: f, error: e.message }); }
}
writeFileSync(join(Q, '_errors.json'), JSON.stringify(errors, null, 2));
console.log(`imported ${n} items, ${errors.length} errors`); errors.forEach(e => console.log(` - ${e.file}: ${e.error}`));
await close();
