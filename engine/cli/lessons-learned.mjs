// After a successful planner or revise run: mark the feedback the planner saw (content/context/feedback-new.json)
// as learned - its lessons are in P/brand/lessons.md now - so it is not offered again. Feedback that needs a
// change in the engine (a template, the sound mix, how something moves or looks: nothing a spec can change),
// which the planner lists in content/queue/_engine-feedback.json, goes to Alex as one message so it is not lost.
import '../env.mjs';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { db, close } from '../db.mjs';
import { markLearned } from '../lessons.mjs';
import { notify } from '../notify.mjs';

const P = project();
const read = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const seen = read(join(P.paths.context, 'feedback-new.json'))?.items || [];
const d = await db();
const n = await markLearned(d, seen.map(f => f.key).filter(Boolean));
console.log(`[${P.id}] lessons: ${seen.length} new comments seen, ${n} marked learned`);

const engFile = join(P.paths.queue, '_engine-feedback.json');
const eng = (read(engFile) || []).filter(e => e && (e.what || e.comment));
if (eng.length) {
  await notify(`Feedback die een aanpassing in de engine nodig heeft (${eng.length})`, [
    'Deze opmerkingen kan de planner niet zelf oplossen: ze vragen een wijziging in de templates, het geluid of de animatie.',
    ...eng.map(e => `- ${e.what || e.comment}${e.itemId ? ` (${e.itemId})` : ''}${e.comment && e.what ? ` - jij: "${String(e.comment).slice(0, 160)}"` : ''}`),
    `De regels staan al in projects/${P.id}/brand/lessons.md onder "Nog op te lossen in de engine". Vraag Claude in een sessie om ze op te lossen.`,
  ]);
  console.log(`[${P.id}] engine feedback: ${eng.length} sent to Alex`);
}
if (existsSync(engFile)) rmSync(engFile);
await close();
