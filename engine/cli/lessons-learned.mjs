// After a successful planner, revise or learn run: mark the feedback the planner saw (content/context/feedback-new.json)
// as learned - its lessons are in P/brand/lessons.md now - so it is not offered again. Feedback that needs a
// change in the engine (a template, the sound mix, how something moves or looks: nothing a spec can change),
// which the planner lists in content/queue/_engine-feedback.json, starts the Engine fix workflow: Claude
// changes the engine on a branch and Alex gets the pull request to merge.
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
  const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
  let started = false;
  if (GITHUB_TOKEN && GITHUB_REPOSITORY) {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/engine-fix.yml/dispatches`, {
      method: 'POST', headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME || 'main', inputs: { project: P.id } }) }).catch(e => ({ ok: false, text: async () => e.message }));
    started = r.ok; if (!r.ok) console.error(`engine-fix not started: ${r.status || ''} ${await r.text()}`);
  }
  await notify(`Feedback voor de engine (${eng.length}): ${started ? 'Claude past het aan' : 'nog op te lossen'}`, [
    'Deze opmerkingen vragen een wijziging in de templates, het geluid of de animatie - geen script kan ze oplossen:',
    ...eng.map(e => `- ${e.what || e.comment}${e.itemId ? ` (${e.itemId})` : ''}`),
    started ? 'Claude maakt de aanpassing nu op een aparte branch en controleert hem. Je krijgt een bericht met de pull request om te mergen; daarna gelden ze voor elke nieuwe video.'
      : `Ze staan in projects/${P.id}/brand/lessons.md onder "Nog op te lossen in de engine". Start de workflow Engine fix, of vraag Claude in een sessie.`,
  ]);
  console.log(`[${P.id}] engine feedback: ${eng.length}${started ? ', Engine fix started' : ''}`);
}
if (existsSync(engFile)) rmSync(engFile);
await close();
