// Put items back in the render queue (run by render.yml before rendering, input "requeue").
//   node engine/cli/requeue.mjs voiced-before=<ISO time> [--dry]
//       voiced items not yet published that were rendered before that time (e.g. a voice fix);
//       approved ones go back to review, so Alex sees the new version before it goes out
//   node engine/cli/requeue.mjs stuck [--dry]
//       items left in "rendering" by a cancelled run
// Several modes may be combined, comma separated: "stuck,voiced-before=2026-10-23T15:10:00Z".
import '../env.mjs';
import { project } from '../project.mjs';
import { db, close, STATUS } from '../db.mjs';

const P = project();
const dry = process.argv.includes('--dry');
const modes = (process.argv.slice(2).find(a => !a.startsWith('--')) || '').split(',').map(s => s.trim()).filter(Boolean);
if (!modes.length) { console.log('nothing to requeue (no mode given)'); process.exit(0); }
const d = await db();
const items = d.collection('items');
const open = [STATUS.QUEUED, STATUS.RENDERING, STATUS.REVIEW, STATUS.APPROVED, STATUS.FAILED];   // not "changes": that waits for the reviser
const picked = new Map();
for (const m of modes) {
  const [name, arg] = m.split('=');
  let found = [];
  if (name === 'stuck') found = await items.find({ status: STATUS.RENDERING }).toArray();
  else if (name === 'voiced-before') {
    const t = new Date(arg); if (isNaN(t)) throw new Error(`voiced-before needs an ISO time, got "${arg}"`);
    found = await items.find({ status: { $in: open }, 'spec.voice': { $exists: true, $nin: [null, 'none'] }, renderedAt: { $lt: t } }).toArray();
  } else throw new Error(`unknown mode "${name}" (use stuck or voiced-before=<ISO time>)`);
  for (const it of found) picked.set(it._id, { it, why: name });
}
console.log(`[${P.id}] ${picked.size} item(s) to render again${dry ? ' (dry run, nothing changed)' : ''}:`);
for (const { it, why } of [...picked.values()].sort((a, b) => a.it.slot - b.it.slot)) {
  console.log(` - ${it._id}  ${it.status}  slot ${it.slot?.toISOString?.() || it.slot}  (${why})`);
  if (dry) continue;
  const note = why === 'stuck' ? 'opnieuw in de wachtrij: render was afgebroken'
    : `opnieuw gemaakt: hele tekst in één opname, dus één stem${it.status === STATUS.APPROVED ? ' - keur opnieuw goed' : ''}`;
  await items.updateOne({ _id: it._id }, { $set: { status: STATUS.QUEUED, renderAttempts: 0, updatedAt: new Date() }, $unset: { error: '' },
    $push: { history: { at: new Date(), event: 'requeued', note, from: it.status } } });
}
await close();
