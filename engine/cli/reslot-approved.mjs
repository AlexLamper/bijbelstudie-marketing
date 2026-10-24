// By hand (maintenance.yml): give every approved item that has not gone out yet a posting time by the
// approval rule (engine/slots.mjs), in the order they were approved, starting from now. Needed once for
// items approved while the planner's date was still the posting date. Items whose publishing already
// started (they have results, e.g. waiting for a linked account) keep their slot. Idempotent enough:
// a second run moves the same items to the same or earlier free times.
//   node engine/cli/reslot-approved.mjs             apply
//   node engine/cli/reslot-approved.mjs --dry-run   only print what would change
import '../env.mjs';
import { db, close, STATUS } from '../db.mjs';
import { project } from '../project.mjs';
import { TAKES_SLOT, nextFreeSlot, slotFields, scheduledEvent, localDay } from '../slots.mjs';

const P = project(); const tz = P.timezone || 'Europe/Amsterdam';
const dry = process.argv.includes('--dry-run');
const d = await db(); const items = d.collection('items');
const now = new Date();
const when = at => at ? `${localDay(at, tz)} ${new Intl.DateTimeFormat('nl-NL', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(at))}` : '-';

const approved = await items.find({ status: STATUS.APPROVED }).toArray();
const started = it => !!it.results && Object.keys(it.results).length > 0;
// the latest approval (an item can be approved, sent back and approved again)
const approvedAt = it => {
  const ev = (it.history || []).filter(h => h.event === 'approve' || h.event === 'approve-all').map(h => +new Date(h.at));
  return ev.length ? Math.max(...ev) : +new Date(it.updatedAt || it.createdAt || it.slot || 0);
};
const todo = approved.filter(it => !started(it)).sort((a, b) => approvedAt(a) - approvedAt(b) || String(a._id).localeCompare(String(b._id)));

// times already taken by items that are not being moved
const moving = new Set(todo.map(it => String(it._id)));
const taken = (await items.find({ status: { $in: TAKES_SLOT }, slot: { $gt: now } }, { projection: { slot: 1 } }).toArray())
  .filter(o => !moving.has(String(o._id))).map(o => o.slot);

console.log(`[${P.id}] ${todo.length} approved items get a posting time${dry ? ' (dry run, nothing saved)' : ''}`);
for (const it of todo) {
  const slot = nextFreeSlot(it.kind, it.spec?.platforms || [], taken, { now, tz });
  taken.push(slot.at);
  console.log(`  ${String(it._id).padEnd(34)} ${it.kind.padEnd(15)} ${when(it.slot).padEnd(16)} -> ${localDay(slot.at, tz)} ${slot.time} (${slot.week})`);
  if (dry) continue;
  await items.updateOne({ _id: it._id, status: STATUS.APPROVED },
    { $set: { ...slotFields(slot), updatedAt: now }, $push: { history: { ...scheduledEvent(slot, tz, now), by: 'reslot-approved' } } });
}
for (const it of approved.filter(started)) console.log(`  ${it._id}: publishing already started - keeps ${when(it.slot)}`);
await close();
