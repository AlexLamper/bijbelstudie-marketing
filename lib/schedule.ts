import type { Db } from 'mongodb';
import { TAKES_SLOT, localDay, nextFreeSlot, type Slot } from './postingSlots';

// Server side of lib/postingSlots.ts: which times are taken, and the fields an approved item gets.

/** The next free posting time for `item`, given what is already approved or online. */
export async function freeSlotFor(db: Db, item: { _id: any; kind: string; spec?: any }, tz: string, now = new Date(), alsoTaken: Date[] = []): Promise<Slot> {
  const others = await db.collection('items').find(
    { _id: { $ne: item._id }, status: { $in: TAKES_SLOT }, slot: { $gt: now } },
    { projection: { slot: 1 } },
  ).toArray();
  return nextFreeSlot(item.kind, item.spec?.platforms || [], [...others.map(o => o.slot), ...alsoTaken], { now, tz });
}

/** $set fields for a scheduled item: the slot itself, and the week it now belongs to. */
export const slotFields = (slot: Slot) => ({ slot: slot.at, 'spec.slot': slot.iso, week: slot.week, 'spec.week': slot.week });

/** The history event that records the posting time (local time in the note). */
export const scheduledEvent = (slot: Slot, tz: string, at: Date) => ({ at, event: 'scheduled', note: `${localDay(slot.at, tz)} ${slot.time}` });
