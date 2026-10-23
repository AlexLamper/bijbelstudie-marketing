// One-off: give items planned before the subject field existed their subject, from
// projects/<id>/content/subjects.json ({ subjects: { itemId: subject } }), so the no-repeat check
// (engine/repeats.mjs) knows what they were about. Never overwrites a subject that is set.
//   node engine/cli/set-subjects.mjs        (run via maintenance.yml)
import '../env.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { db, close } from '../db.mjs';

const P = project();
const file = join(P.paths.content, 'subjects.json');
if (!existsSync(file)) { console.log(`[${P.id}] no content/subjects.json - nothing to do`); process.exit(0); }
const { subjects } = JSON.parse(readFileSync(file, 'utf8'));
const d = await db(); let set = 0, kept = 0, missing = 0;
for (const [id, subject] of Object.entries(subjects)) {
  const it = await d.collection('items').findOne({ _id: id }, { projection: { 'spec.subject': 1 } });
  if (!it) { missing++; console.log(` - ${id}: not found`); continue; }
  if (it.spec?.subject) { kept++; continue; }
  await d.collection('items').updateOne({ _id: id }, { $set: { 'spec.subject': subject } }); set++;
}
console.log(`[${P.id}] subjects set: ${set}, already had one: ${kept}, not found: ${missing}`);
await close();
