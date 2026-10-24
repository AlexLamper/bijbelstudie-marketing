import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';

// Approve every item of a week that waits for review: they go on the pile in the planner's order
// (the publish job takes from the pile every day, lib/postingSlots.ts).
export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  if (!getProject(project)) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { week } = await req.json();
  if (typeof week !== 'string' || !/^\d{4}-W\d{2}$/.test(week)) return NextResponse.json({ error: 'bad week' }, { status: 400 });
  const db = await getDb(project); const at = Date.now();
  const list = await db.collection('items').find({ week, status: 'review' }).sort({ slot: 1, _id: 1 }).toArray();
  let n = 0;
  for (const it of list) {
    const when = new Date(at + n);   // keeps the planner's order on the pile
    const r = await db.collection('items').updateOne({ _id: it._id, status: 'review' }, {
      $set: { status: 'approved', approvedAt: when, updatedAt: when }, $unset: { postAt: '' },
      $push: { history: { at: when, event: 'approve-all' } } as any,
    });
    if (r.modifiedCount) n++;
  }
  return NextResponse.json({ ok: true, message: n ? `${n} goedgekeurd - ze staan op de stapel en gaan vanzelf online.` : 'Niets om goed te keuren.' });
}
