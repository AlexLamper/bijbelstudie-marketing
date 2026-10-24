// Alex's feedback becomes lessons. Every review comment he writes in the studio (on any item: approved,
// changes, rejected) reaches the planner once as new feedback (content/context/feedback-new.json). The
// planner turns what applies to future items into a rule in P/brand/lessons.md (permanent, in git), and
// after a successful run cli/lessons-learned.mjs marks those comments as learned (Mongo `lessons`, one
// document per comment), so they are not offered again. A comment is identified by its item and text, so
// it stays the same comment after the stats job removes a rejected item and keeps only its record.
import { createHash } from 'node:crypto';
import { hookOf } from './repeats.mjs';
import { traitsOf } from './experiments.mjs';

const traits = it => { try { return it.spec ? traitsOf(it.spec, it) : {}; } catch { return {}; } };

export const feedbackKey = (itemId, text) => createHash('sha1').update(`${itemId}|${String(text).trim()}`).digest('hex').slice(0, 16);

/** Every review comment Alex wrote, newest first: items in Mongo `items` plus the records kept of removed rejected items. */
export async function allFeedback(d) {
  const out = [], seen = new Set();
  const push = f => { if (!seen.has(f.key)) { seen.add(f.key); out.push(f); } };
  const items = await d.collection('items').find({ 'reviewComments.0': { $exists: true } }).toArray();
  for (const it of items) for (const c of it.reviewComments || []) {
    const text = String(c?.text || '').trim(); if (!text) continue;
    push({ key: feedbackKey(it._id, text), itemId: it._id, kind: it.kind, status: it.status, at: c.at || null, text,
      subject: it.spec?.subject || null, hook: it.spec ? hookOf(it.spec) : null, traits: traits(it), spec: it.spec || null });
  }
  const kept = await d.collection('rejected').find({ 'reviewComments.0': { $exists: true } }).toArray();
  for (const r of kept) for (const t of r.reviewComments || []) {
    const text = String(t || '').trim(); if (!text) continue;
    push({ key: feedbackKey(r._id, text), itemId: r._id, kind: r.kind, status: 'rejected', at: r.rejectedAt || null, text,
      subject: r.subject || null, hook: r.hook || null, traits: r.traits || {}, spec: null });
  }
  return out.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

/** The keys of comments already turned into lessons. */
export const learnedKeys = async d => new Set((await d.collection('lessons').find({}, { projection: { _id: 1 } }).toArray()).map(x => x._id));

/** Review comments not learned yet, newest first. */
export async function newFeedback(d) {
  const done = await learnedKeys(d);
  return (await allFeedback(d)).filter(f => !done.has(f.key));
}

/** Mark comments as learned (their lesson is in P/brand/lessons.md now). */
export async function markLearned(d, keys, via = 'planner') {
  if (!keys.length) return 0;
  const at = new Date();
  const r = await d.collection('lessons').bulkWrite(keys.map(k => ({ updateOne: { filter: { _id: k }, update: { $setOnInsert: { learnedAt: at, via } }, upsert: true } })));
  return r.upsertedCount;
}
