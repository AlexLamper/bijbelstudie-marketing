// Every review comment Alex wrote in the studio, newest first, and whether it is learned yet (run via maintenance.yml).
//   node engine/cli/feedback.mjs                 list all
//   node engine/cli/feedback.mjs --mark-learned  also mark every listed comment as learned (after writing its
//                                                lessons into P/brand/lessons.md by hand)
import '../env.mjs';
import { project } from '../project.mjs';
import { db, close } from '../db.mjs';
import { allFeedback, learnedKeys, markLearned } from '../lessons.mjs';

const P = project();
const d = await db();
const all = await allFeedback(d), done = await learnedKeys(d);
console.log(`[${P.id}] ${all.length} review comments, ${all.filter(f => done.has(f.key)).length} learned`);
for (const f of all) {
  const when = f.at ? new Date(f.at).toISOString().slice(0, 16).replace('T', ' ') : '?';
  const t = f.traits || {};
  console.log(`${done.has(f.key) ? 'learned' : 'NEW    '} ${when} ${f.itemId} ${f.kind} ${f.status}${f.subject ? ` "${f.subject}"` : ''} [${[t.style3d || t.style, t.voice, t.music].filter(Boolean).join(' ')}]`);
  console.log(`        ${f.text.replace(/\s+/g, ' ')}`);
}
const vs = (await d.collection('settings').findOne({ _id: 'voices' }))?.list || [];
console.log(`[${P.id}] voice test set: ${vs.map(v => `${v.key} = ${v.name}${v.gender ? ` (${v.gender})` : ''}`).join('; ') || '(empty)'}`);
if (process.argv.includes('--mark-learned')) console.log(`[${P.id}] marked learned: ${await markLearned(d, all.map(f => f.key), 'by hand')}`);
await close();
