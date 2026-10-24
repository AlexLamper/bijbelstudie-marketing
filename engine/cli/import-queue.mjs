// Imports what the planner (Claude) wrote into projects/<id>/content/queue/ :
//   *.json        item specs  -> items (status queued)
//   report-*.md   weekly report -> reports
//   replies.json  drafted comment replies -> comments
// --refresh (the Learn workflow): an item waiting for Alex's review (content/context/pending.json) may be
// replaced too - rewritten for his newest feedback; it is made again and comes back to Te beoordelen.
// Invalid specs are not imported; their errors go to content/queue/_errors.json so the
// planner's next run (or a revise run) can fix them.
import '../env.mjs';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { prepare } from '../spec.mjs';
import { repeatProblems, historyFrom, rowOf } from '../repeats.mjs';
import { db, close, STATUS, heartbeat } from '../db.mjs';

const P = project();
const refresh = process.argv.includes('--refresh') ? new Set((() => { try { return JSON.parse(readFileSync(join(P.paths.context, 'pending.json'), 'utf8')).items.map(x => x.id); } catch { return []; } })()) : new Set();
const Q = P.paths.queue;
const DONE = P.paths.imported;
mkdirSync(DONE, { recursive: true });
const d = await db();
const posted = (await d.collection('verses').find().toArray()).map(v => ({ ref: v.ref, date: v.at }));
// the last gate against repeats (the planner's validator checks the same rules first)
const history = historyFrom(await d.collection('items').find({ slot: { $gte: new Date(Date.now() - 400 * 864e5) } }).toArray());
const batch = [];
const errors = []; let n = 0;

for (const f of existsSync(Q) ? readdirSync(Q) : []) {
  const p = join(Q, f);
  try {
    if (f.endsWith('.json') && !f.startsWith('_') && f !== 'replies.json') {
      const raw = JSON.parse(readFileSync(p, 'utf8'));
      const spec = await prepare(raw);
      const repeats = repeatProblems(raw, [...history, ...batch], posted, { requireSubject: false });
      if (repeats.length) throw new Error(repeats.join('; '));
      const existing = await d.collection('items').findOne({ _id: spec.id });
      // Only items Alex sent back (changes), or that never rendered, may be replaced. Anything he is
      // reviewing, approved or that went out stays as it is - a new plan must use new ids.
      const mayRefresh = existing && refresh.has(spec.id) && existing.status === STATUS.REVIEW;
      if (existing && !mayRefresh && ![STATUS.CHANGES, STATUS.QUEUED, STATUS.FAILED].includes(existing.status)) throw new Error(`Item ${spec.id} already exists (${existing.status}) - use a new id / the target week`);
      const aiLabel = !!spec.voice && spec.voice !== 'none';      // AI voice -> platform AI label
      await d.collection('items').updateOne({ _id: spec.id }, {
        $set: { spec, kind: spec.kind, week: spec.week, slot: new Date(spec.slot), status: STATUS.QUEUED, aiLabel, renderAttempts: 0, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date(), history: [] },
        ...(mayRefresh ? { $push: { history: { at: new Date(), event: 'refreshed', note: 'aangepast aan je nieuwste feedback, wordt opnieuw gemaakt' } } } : {}),
      }, { upsert: true });
      n++; batch.push(rowOf(raw));
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
mkdirSync(Q, { recursive: true });
writeFileSync(join(Q, '_errors.json'), JSON.stringify(errors, null, 2));
console.log(`[${P.id}] imported ${n} items, ${errors.length} errors`);
if (process.env.GITHUB_OUTPUT) (await import('node:fs')).appendFileSync(process.env.GITHUB_OUTPUT, `imported=${n}\n`); errors.forEach(e => console.log(` - ${e.file}: ${e.error}`));
await heartbeat('import', { items: n, errors: errors.length });
await close();
