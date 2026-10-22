// MongoDB access for the engine scripts (the dashboard has its own copy in app/lib/mongo.ts).
// Collections:
//   items     one row per post/reel: spec, status, media, per-platform results, metrics
//   tokens    OAuth tokens that rotate (TikTok, YouTube) - never in git
//   verses    every verse that went out (the never-reuse ledger)
//   metrics   daily account numbers (followers, signups)
//   insights  competitor snapshots from Instagram Business Discovery
//   reports   weekly reports written by the planner
//   comments  incoming comments + drafted replies
import { MongoClient } from 'mongodb';

let client;
export async function db() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  client ??= await new MongoClient(process.env.MONGODB_URI).connect();
  return client.db(process.env.MONGODB_DB || 'bijbelstudie_marketing');
}
export async function close() { await client?.close(); client = undefined; }

// Item lifecycle
export const STATUS = {
  QUEUED: 'queued',          // spec imported, waiting for render
  RENDERING: 'rendering',
  REVIEW: 'review',          // rendered, waiting for Alex
  CHANGES: 'changes',        // Alex commented; the planner revises it, then it renders again
  APPROVED: 'approved',      // will go out at its slot
  REJECTED: 'rejected',
  PUBLISHED: 'published',
  PARTIAL: 'partial',        // some platforms failed
  FAILED: 'failed',
};

export async function getToken(name) { return (await db()).collection('tokens').findOne({ _id: name }); }
export async function saveToken(name, data) {
  await (await db()).collection('tokens').updateOne({ _id: name }, { $set: { ...data, updatedAt: new Date() } }, { upsert: true });
}
