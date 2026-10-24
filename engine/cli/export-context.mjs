// Before the planner runs: write everything it should know into projects/<id>/content/context/ -
// the day to plan (target-week.json) and its allocation, last weeks' results per item, Alex's review
// comments (and the ones not yet learned as lessons), what he rejected, competitor patterns, comments
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

// Which day to plan: the first day from tomorrow (project timezone) that has no items yet, by the date the
// planner gave them (plannedSlot once the publish job has given an item its real posting time). Only a label
// for ids and the day's recipe now: items go online from the pile of approved items, not on this date.
// The file keeps its name (target-week.json) and its shape; `days` holds just that one day.
const { dayTarget } = await import('../days.mjs');
const since = new Date(Date.now() - 2 * 864e5);
const upcoming = await d.collection('items').find({ $or: [{ plannedSlot: { $gte: since } }, { plannedSlot: null, slot: { $gte: since } }] }, { projection: { slot: 1, plannedSlot: 1 } }).toArray();
const T = dayTarget(upcoming.map(it => it.plannedSlot || it.slot), { tz: P.timezone });
const target = { date: T.date, day: T.day, week: T.week, idPrefix: T.idPrefix, utcOffset: T.utcOffset,
  note: `Plan exactly this one day (${T.day} ${T.date}, ${P.timezone}). Item ids start with idPrefix, e.g. ${T.idPrefix}-verse; "week" is ${T.week}.`,
  days: [{ day: T.day, date: T.date, utcOffset: T.utcOffset }], daysAhead: T.daysAhead, plannedDays: T.plannedDays };
writeFileSync(join(OUTD, 'target-week.json'), JSON.stringify(target, null, 2));
if (process.env.GITHUB_OUTPUT) (await import('node:fs')).appendFileSync(process.env.GITHUB_OUTPUT, `date=${T.date}\n`);
// Plan a day every morning, unless enough is waiting already: PLAN_BACKLOG items still to be made or
// reviewed, or PLAN_PILE approved items not yet online (about a week of posts). The context is still
// written in full (a revise run needs it); only the planning steps are skipped.
const PLAN_BACKLOG = 20, PLAN_PILE = 25;
const backlog = await d.collection('items').countDocuments({ status: { $in: ['queued', 'rendering', 'review', 'changes'] } });
const pile = await d.collection('items').countDocuments({ status: 'approved', postAt: null });
const skip = (backlog >= PLAN_BACKLOG || pile >= PLAN_PILE) && !process.env.PLAN_FORCE;

// Experiments: the scoreboard and the day's allocation (engine/experiments.mjs), the voices and
// music that exist, and the voice budget for the day.
const { updateBoard, voiceKeys, musicMoods } = await import('../library.mjs');
const { weekAllocation, FEED_DAYS } = await import('../experiments.mjs');
const { elevenlabsBudget, voiceLibrary } = await import('../tts/index.mjs');
const seed = Number(T.date.replace(/\D/g, ''));   // per day: a re-run for the same day gives the same draw
const B = await updateBoard(d, { seed });
// project.json recipe (Alex, 24 Oct): reelsPerDay reels that all go to every platform, feedPosts 0 = no feed posts
const R = project().recipe || {};
const allocation = { date: T.date, day: T.day, week: T.week, ...weekAllocation(B.board, { days: 1, ...(R.reelsPerDay != null ? { mainPerDay: R.reelsPerDay, extraPerDay: 0 } : {}),
  feedPosts: R.feedPosts === 0 ? 0 : FEED_DAYS.includes(T.day) ? 1 : 0, seed: seed + 7919 }) };
const budget = await elevenlabsBudget();
if (budget) {   // share of what is left this month that this day may use (days left until the reset)
  const daysLeft = budget.resetsAt ? Math.max(1, Math.ceil((new Date(budget.resetsAt) - Date.now()) / 864e5)) : 30;
  allocation.voiceBudget = { charsForDay: Math.max(0, Math.floor(budget.left / daysLeft) - 100), leftThisMonth: budget.left, daysUntilReset: daysLeft, resetsAt: budget.resetsAt, note: 'Total spoken characters of all voiced items of this day must stay under charsForDay (the validator checks). Over budget: shorter narration, fewer scenes or shots.' };
}
writeFileSync(join(OUTD, 'allocation.json'), JSON.stringify(allocation, null, 2));
if (!skip) await d.collection('experiments').updateOne({ _id: `allocation-${T.date}` }, { $set: { ...allocation, at: new Date() } }, { upsert: true });
writeFileSync(join(OUTD, 'experiments.json'), JSON.stringify({ note: 'Per trait value: n = scored item-platform results, mean = average fair score (0.5 = median), avgViews, pBest = chance it is the best. Higher pBest got more slots in allocation.json.', trials: B.trials, items: B.items, board: B.board }, null, 2));
writeFileSync(join(OUTD, 'voices.json'), JSON.stringify({ note: 'Voice keys a spec may use in "voice". male/female = the two default voices.', voices: voiceKeys(voiceLibrary()).map(k => { const v = voiceLibrary().find(x => x.key === k); return { key: k, name: v?.name || k, gender: v?.gender || (k === 'male' || k === 'female' ? k : null) }; }), musicMoods: musicMoods() }, null, 2));

const changes = await d.collection('items').find({ status: STATUS.CHANGES }).toArray();
writeFileSync(join(OUTD, 'changes-requested.json'), JSON.stringify(changes.map(it => ({ id: it._id, spec: it.spec, comments: it.reviewComments })), null, 2));

// What Alex rejected in the last 60 days: the records the stats job keeps when it removes a rejected item
// (Mongo `rejected`), plus items rejected less than a day ago that are still there.
const { rejectedRecord } = await import('../repeats.mjs');
const fresh = (await d.collection('items').find({ status: STATUS.REJECTED }).toArray()).map(rejectedRecord);
const kept = await d.collection('rejected').find({ rejectedAt: { $gte: new Date(Date.now() - 60 * 864e5) } }).toArray();
const rejected = [...fresh, ...kept.filter(r => !fresh.some(f => f._id === r._id))]
  .sort((a, b) => new Date(b.rejectedAt || 0) - new Date(a.rejectedAt || 0)).map(({ _id, ...r }) => ({ id: _id, ...r }));
writeFileSync(join(OUTD, 'rejected.json'), JSON.stringify({ note: 'Items Alex rejected in the last 60 days, newest first: kind, subject, hook, traits and his comments. Avoid making that again - read his comments to see why.', items: rejected }, null, 2));

// Alex's review comments not yet turned into lessons (P/brand/lessons.md; planner/PLAN.md step 1b).
// cli/lessons-learned.mjs marks them learned after the run succeeded, so a failed run sees them again.
const { writeNewFeedback } = await import('../lessons.mjs');
const feedback = { length: await writeNewFeedback(d, OUTD) };

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
// Everything planned or posted in the last year (not rejected): verses, subjects and hooks the new day
// must not repeat (engine/repeats.mjs, checked by the validator and again on import).
const { historyFrom, VERSE_DAYS, SUBJECT_WEEKS, APP_SUBJECT_WEEKS, HOOK_WEEKS } = await import('../repeats.mjs');
const history = historyFrom(await d.collection('items').find({ slot: { $gte: new Date(Date.now() - 400 * 864e5) } }).sort({ slot: -1 }).toArray());
writeFileSync(join(OUTD, 'history.json'), JSON.stringify({ note: `Do not repeat: a verse of the day never again; any shown verse not within ${VERSE_DAYS} days; a subject not within ${SUBJECT_WEEKS} weeks (app/praktisch: ${APP_SUBJECT_WEEKS}) and never twice in a week; a hook not (nearly) the same within ${HOOK_WEEKS} weeks. Newest first.`, items: history }, null, 2));
console.log(`[${P.id}] target ${T.day} ${T.date} (${T.week}, ${T.daysAhead} days ahead); context: ${rows.length} items, ${history.length} in history, ${changes.length} changes, ${rejected.length} rejected, ${feedback.length} new review comments to learn from, ${comments.length} comments, ${top.length} competitor posts`);
if (skip) {
  console.log(`[${P.id}] enough waiting (${backlog} to make or review, ${pile} approved on the pile) - no new day planned today`);
  if (process.env.GITHUB_OUTPUT) (await import('node:fs')).appendFileSync(process.env.GITHUB_OUTPUT, 'skip=true\n');
}
await heartbeat('plan', { day: T.date, items: rows.length, changes: changes.length });
await close();
