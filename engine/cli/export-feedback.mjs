// The Learn workflow's context: content/context/feedback-new.json (Alex's review comments not yet turned
// into lessons) and pending.json (items made but not yet approved - Learn brings them in line with the new
// rules, so Alex does not see the same mistake again). Step outputs new=<count>, run=1 when Claude has work.
//   --recheck  also when there is no new comment: every item not yet approved against every rule
import '../env.mjs';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { db, close, STATUS } from '../db.mjs';
import { writeNewFeedback } from '../lessons.mjs';

const P = project();
const d = await db();
const n = await writeNewFeedback(d, P.paths.context);
const recheck = process.argv.includes('--recheck');
const pending = n || recheck ? await d.collection('items').find({ status: { $in: [STATUS.QUEUED, STATUS.REVIEW] } }).toArray() : [];
writeFileSync(join(P.paths.context, 'pending.json'), JSON.stringify({ note: 'Items made or being made that Alex has not approved yet (queued or review). Any that breaks a rule you just added to brand/lessons.md: rewrite it (planner/LEARN.md step 4).', items: pending.map(it => ({ id: it._id, kind: it.kind, status: it.status, spec: it.spec })) }, null, 2));
console.log(`[${P.id}] ${n} new review comments to learn from; ${pending.length} items not yet approved`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `new=${n}\nrun=${n || (recheck && pending.length) ? 1 : 0}\n`);
await close();
