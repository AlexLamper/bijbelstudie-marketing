// Before the planner runs: write everything it should know into content/context/ -
// last weeks' results per item, Alex's review comments, competitor patterns, comments
// waiting for a reply, items marked "changes", and the used-verse ledger.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.mjs';
import { db, close, STATUS } from '../db.mjs';

const OUTD = join(ROOT, 'content', 'context'); mkdirSync(OUTD, { recursive: true });
const d = await db();
const weeksBack = new Date(Date.now() - 42 * 864e5);
const items = await d.collection('items').find({ createdAt: { $gte: weeksBack } }).sort({ slot: 1 }).toArray();

const score = it => { const ig = it.metrics?.instagram || {}, yt = it.metrics?.youtube || {}; return { views: (ig.views || 0) + (yt.views || 0), saves: ig.saved || 0, shares: ig.shares || 0, likes: (ig.likes || 0) + (yt.likes || 0), comments: (ig.comments || 0) + (yt.comments || 0) }; };
const rows = items.map(it => ({ id: it._id, week: it.week, kind: it.kind, status: it.status, experiment: it.spec.experiment, hook: it.spec.hook || it.spec.headline || it.spec.line || it.spec.ref, slot: it.spec.slot, results: score(it), review: (it.reviewComments || []).map(c => c.text) }));
writeFileSync(join(OUTD, 'performance.json'), JSON.stringify(rows, null, 2));

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
const ledger = { note: 'Verses already posted on social. Never reuse one.', verses: [{ ref: 'Spreuken 3:5' }, ...verses.map(v => ({ ref: v.ref, date: v.at }))] };
writeFileSync(join(ROOT, 'content', 'used-verses.json'), JSON.stringify(ledger, null, 2));
console.log(`context: ${rows.length} items, ${changes.length} changes, ${comments.length} comments, ${top.length} competitor posts`);
await close();
