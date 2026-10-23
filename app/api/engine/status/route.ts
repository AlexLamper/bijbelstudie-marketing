import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { engineAuthorized } from '@/lib/engine-auth';
import { DEFAULT_PROJECT, PROJECTS, getProject } from '@/lib/projects';

export const dynamic = 'force-dynamic';

// Health check for the engine: database reachable, item counts per status, recent problems.
// GET /api/engine/status?key=ENGINE_KEY[&project=<id>]  (default: the first enabled project)
export async function GET(req: Request) {
  if (!engineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const project = new URL(req.url).searchParams.get('project') || DEFAULT_PROJECT;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project', projects: PROJECTS.map(p => p.id) }, { status: 404 });
  const out: any = { at: new Date().toISOString(), project, projects: PROJECTS.map(p => p.id), blob: !!process.env.BLOB_READ_WRITE_TOKEN };
  try {
    const db = await getDb(project);
    await db.command({ ping: 1 });
    out.mongo = 'ok';
    out.byStatus = Object.fromEntries((await db.collection('items').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray()).map(r => [r._id, r.n]));
    out.byWeek = Object.fromEntries((await db.collection('items').aggregate([{ $group: { _id: '$week', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray()).map(r => [r._id, r.n]));
    out.problems = (await db.collection('items').find({ $or: [{ status: 'failed' }, { renderNotes: { $exists: true, $ne: [] } }] }, { projection: { status: 1, error: 1, renderNotes: 1 } }).limit(20).toArray());
    out.latest = (await db.collection('items').find({}, { projection: { status: 1, 'media.url': 1, renderedAt: 1 } }).sort({ renderedAt: -1 }).limit(3).toArray());
    // linked accounts (names and last check only - never tokens) and the last run of each job
    out.connections = Object.fromEntries((await db.collection('connections').find({}, { projection: { account: 1, lastCheck: 1, pending: 1 } }).toArray())
      .map(c => [c._id, { name: c.account?.name, linked: !c.pending || !!c.account?.name, check: c.lastCheck }]));
    out.runs = Object.fromEntries((await db.collection('runs').find({}, { projection: { at: 1, summary: 1, configured: 1 } }).toArray()).map(r => [r._id, r]));
  } catch (e: any) { out.mongo = `error: ${e.message}`; }
  return NextResponse.json(out);
}
