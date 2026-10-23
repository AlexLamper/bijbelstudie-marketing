// Before the planner runs: write everything it should know into projects/<id>/content/context/ -
// last weeks' results per item, Alex's review comments, competitor patterns, comments
// waiting for a reply, items marked "changes", and the used-verse ledger.
import '../env.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { db, close, STATUS, heartbeat } from '../db.mjs';

const P = project();
const OUTD = P.paths.context; mkdirSync(OUTD, { recursive: true });
const d = await db();
const weeksBack = new Date(Date.now() - 42 * 864e5);
const items = await d.collection('items').find({ createdAt: { $gte: weeksBack } }).sort({ slot: 1 }).toArray();

const score = it => { const m = Object.values(it.metrics || {}); const sum = k => m.reduce((n, x) => n + (x?.[k] || 0), 0); return { views: sum('views'), saves: sum('saved'), shares: sum('shares'), likes: sum('likes'), comments: sum('comments') }; };
const { traitsOf } = await import('../experiments.mjs');
const rows = items.map(it => ({ id: it._id, week: it.week, kind: it.kind, status: it.status, traits: traitsOf(it.spec, it), experiment: it.spec.experiment,
  hook: it.spec.hook || it.spec.question || it.spec.headline || it.spec.line || it.spec.slides?.[0]?.title || it.spec.ref, slot: it.spec.slot, platforms: it.spec.platforms,
  results: score(it), perPlatform: it.metrics || {}, review: (it.reviewComments || []).map(c => c.text) }));
writeFileSync(join(OUTD, 'performance.json'), JSON.stringify(rows, null, 2));

// Which week to plan: the first week after the current one that has no items yet.
const isoWeekOf = date => { const t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`; };
const planned = new Set(await d.collection('items').distinct('week'));
let monday = new Date(); monday.setUTCHours(12, 0, 0, 0); monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() || 7) - 1) + 7);
while (planned.has(isoWeekOf(monday))) monday.setUTCDate(monday.getUTCDate() + 7);
const dayNames = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const target = { week: isoWeekOf(monday), idPrefix: isoWeekOf(monday).toLowerCase(), note: 'Plan exactly this week. Item ids start with idPrefix, e.g. ' + isoWeekOf(monday).toLowerCase() + '-verse-mon.',
  days: dayNames.map((name, i) => { const dt = new Date(monday); dt.setUTCDate(monday.getUTCDate() + i);
    const off = new Intl.DateTimeFormat('en', { timeZone: P.timezone, timeZoneName: 'longOffset' }).formatToParts(dt).find(x => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
    return { day: name, date: dt.toISOString().slice(0, 10), utcOffset: off }; }),
  alreadyPlanned: [...planned].sort() };
writeFileSync(join(OUTD, 'target-week.json'), JSON.stringify(target, null, 2));
// Never plan more than two weeks ahead (a second run on the same Friday would otherwise plan the week after).
const weeksAhead = Math.round((monday - new Date(Date.now() - ((new Date().getUTCDay() || 7) - 1) * 864e5)) / (7 * 864e5));
// The context is still written in full (a revise run needs it); only the planning steps are skipped.
const skip = weeksAhead > 2 && !process.env.PLAN_FORCE;

// Experiments: the scoreboard and next week's allocation (engine/experiments.mjs), the voices and
// music that exist, and the voice budget left this month.
const { updateBoard, voiceKeys, musicMoods } = await import('../library.mjs');
const { weekAllocation } = await import('../experiments.mjs');
const { elevenlabsBudget, voiceLibrary } = await import('../tts/index.mjs');
const B = await updateBoard(d, { seed: Number(target.week.replace(/\D/g, '')) });
const allocation = { week: target.week, ...weekAllocation(B.board) };
const budget = await elevenlabsBudget();
if (budget) {   // share of what is left this month that this week may use (weeks left until the reset)
  const weeksLeft = budget.resetsAt ? Math.max(1, Math.ceil((new Date(budget.resetsAt) - Date.now()) / (7 * 864e5))) : 4;
  allocation.voiceBudget = { charsThisWeek: Math.max(0, Math.floor(budget.left / weeksLeft) - 500), leftThisMonth: budget.left, resetsAt: budget.resetsAt, note: 'Total spoken characters of all voiced items this week must stay under charsThisWeek (the validator checks). Over budget: use formats without voice (reel-kinetic, reel-quiz, reel-list, reel-verse without voice, reel-demo).' };
}
writeFileSync(join(OUTD, 'allocation.json'), JSON.stringify(allocation, null, 2));
if (!skip) await d.collection('experiments').updateOne({ _id: `allocation-${target.week}` }, { $set: { ...allocation, at: new Date() } }, { upsert: true });
writeFileSync(join(OUTD, 'experiments.json'), JSON.stringify({ note: 'Per trait value: n = scored item-platform results, mean = average fair score (0.5 = median), avgViews, pBest = chance it is the best. Higher pBest got more slots in allocation.json.', trials: B.trials, items: B.items, board: B.board }, null, 2));
writeFileSync(join(OUTD, 'voices.json'), JSON.stringify({ note: 'Voice keys a spec may use in "voice". male/female = the two default voices.', voices: voiceKeys(voiceLibrary()).map(k => { const v = voiceLibrary().find(x => x.key === k); return { key: k, name: v?.name || k, gender: v?.gender || (k === 'male' || k === 'female' ? k : null) }; }), musicMoods: musicMoods() }, null, 2));

const changes = await d.collection('items').find({ status: STATUS.CHANGES }).toArray();
writeFileSync(join(OUTD, 'changes-requested.json'), JSON.stringify(changes.map(it => ({ id: it._id, spec: it.spec, comments: it.reviewComments })), null, 2));

const comments = await d.collection('comments').find({ status: 'new', draft: { $exists: false } }).limit(100).toArray();
writeFileSync(join(OUTD, 'comments-to-answer.json'), JSON.stringify(comments.map(c => ({ commentId: c._id, itemId: c.itemId, username: c.username, text: c.text })), null, 2));

const insights = await d.collection('insights').find({ at: { $gte: weeksBack } }).sort({ at: -1 }).toArray();
const top = insights.flatMap(i => (i.snap?.media?.data || []).map(m => ({ account: i.username, type: m.media_product_type, caption: (m.caption || '').slice(0, 300), likes: m.like_count, comments: m.comments_count, views: m.view_count, at: m.timestamp })))
  .sort((a, b) => (b.views || b.likes || 0) - (a.views || a.likes || 0)).slice(0, 40);
writeFileSync(join(OUTD, 'competitor-top-posts.json'), JSON.stringify(top, null, 2));

const metrics = await d.collection('metrics').find().sort({ _id: -1 }).limit(42).toArray();
writeFileSync(join(OUTD, 'account-metrics.json'), JSON.stringify(metrics, null, 2));

const verses = await d.collection('verses').find().toArray();
// keep refs that are only in the file (e.g. verses posted before the engine existed)
const { existsSync, readFileSync } = await import('node:fs');
const before = existsSync(P.paths.usedVerses) ? JSON.parse(readFileSync(P.paths.usedVerses, 'utf8')).verses : [];
const inDb = new Set(verses.map(v => v.ref));
const ledger = { note: 'Verses already posted on social. Never reuse one.', verses: [...before.filter(v => !inDb.has(v.ref) && !v.date), ...verses.map(v => ({ ref: v.ref, date: v.at }))] };
writeFileSync(P.paths.usedVerses, JSON.stringify(ledger, null, 2));
// Everything planned or posted in the last year (not rejected): verses, subjects and hooks the new week
// must not repeat (engine/repeats.mjs, checked by the validator and again on import).
const { historyFrom, VERSE_DAYS, SUBJECT_WEEKS, APP_SUBJECT_WEEKS, HOOK_WEEKS } = await import('../repeats.mjs');
const history = historyFrom(await d.collection('items').find({ slot: { $gte: new Date(Date.now() - 400 * 864e5) } }).sort({ slot: -1 }).toArray());
writeFileSync(join(OUTD, 'history.json'), JSON.stringify({ note: `Do not repeat: a verse of the day never again; any shown verse not within ${VERSE_DAYS} days; a subject not within ${SUBJECT_WEEKS} weeks (app/praktisch: ${APP_SUBJECT_WEEKS}) and never twice in a week; a hook not (nearly) the same within ${HOOK_WEEKS} weeks. Newest first.`, items: history }, null, 2));
console.log(`[${P.id}] target ${target.week}; context: ${rows.length} items, ${history.length} in history, ${changes.length} changes, ${comments.length} comments, ${top.length} competitor posts`);
if (skip) {
  console.log(`[${P.id}] ${target.week} is ${weeksAhead} weeks ahead - the coming weeks are planned already, no new week to plan`);
  if (process.env.GITHUB_OUTPUT) (await import('node:fs')).appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
}
await heartbeat('plan', { items: rows.length, changes: changes.length });
await close();
