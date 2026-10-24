import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { getProject } from '@/lib/projects';
import { DEFAULT_TZ, slotMessage } from '@/lib/postingSlots';
import { freeSlotFor, scheduledEvent, slotFields } from '@/lib/schedule';

// Approve every item of a week that waits for review. Each gets the next free posting time from now
// (lib/postingSlots.ts), in the order the planner put them in.
export async function POST(req: Request, { params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  const p = getProject(project);
  if (!p) return NextResponse.json({ error: 'unknown project' }, { status: 404 });
  const { week } = await req.json();
  if (typeof week !== 'string' || !/^\d{4}-W\d{2}$/.test(week)) return NextResponse.json({ error: 'bad week' }, { status: 400 });
  const db = await getDb(project); const tz = p.timezone || DEFAULT_TZ; const at = new Date();
  const list = await db.collection('items').find({ week, status: 'review' }).sort({ slot: 1, _id: 1 }).toArray();
  const given: Date[] = []; let first: Date | null = null; let n = 0;
  for (const it of list) {
    const slot = await freeSlotFor(db, it as any, tz, at, given);
    const r = await db.collection('items').updateOne({ _id: it._id, status: 'review' }, {
      $set: { status: 'approved', updatedAt: at, ...slotFields(slot) },
      $push: { history: { $each: [{ at, event: 'approve-all' }, scheduledEvent(slot, tz, at)] } } as any,
    });
    if (!r.modifiedCount) continue;
    given.push(slot.at); n++;
    if (!first || slot.at < first) first = slot.at;
  }
  const lead = first ? slotMessage(first, { now: at, tz }) : '';
  return NextResponse.json({ ok: true, message: n ? `${n} goedgekeurd - de eerste ${lead.charAt(0).toLowerCase()}${lead.slice(1)}.` : 'Niets om goed te keuren.' });
}
