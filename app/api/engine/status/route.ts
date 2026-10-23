import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export const dynamic = 'force-dynamic';

// Health check for the engine: database reachable, item counts per status, recent problems.
// GET /api/engine/status?key=ENGINE_KEY
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!process.env.ENGINE_KEY || key !== process.env.ENGINE_KEY) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const out: any = { at: new Date().toISOString(), blob: !!process.env.BLOB_READ_WRITE_TOKEN };
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    out.mongo = 'ok';
    out.byStatus = Object.fromEntries((await db.collection('items').aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray()).map(r => [r._id, r.n]));
    out.byWeek = Object.fromEntries((await db.collection('items').aggregate([{ $group: { _id: '$week', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray()).map(r => [r._id, r.n]));
    out.problems = (await db.collection('items').find({ $or: [{ status: 'failed' }, { renderNotes: { $exists: true, $ne: [] } }] }, { projection: { status: 1, error: 1, renderNotes: 1 } }).limit(20).toArray());
    out.latest = (await db.collection('items').find({}, { projection: { status: 1, 'media.url': 1, renderedAt: 1 } }).sort({ renderedAt: -1 }).limit(3).toArray());
  } catch (e: any) { out.mongo = `error: ${e.message}`; }
  return NextResponse.json(out);
}
