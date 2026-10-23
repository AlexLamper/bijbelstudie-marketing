// Prints a week's items: id, kind, status, slot, platforms, Alex's comments (run via maintenance.yml).
//   node engine/cli/week-status.mjs 2026-W45
import '../env.mjs';
import { db, close } from '../db.mjs';
import { project } from '../project.mjs';

const week = process.argv[2]; if (!week) { console.error('usage: week-status.mjs <YYYY-Www>'); process.exit(2); }
const d = await db();
const items = await d.collection('items').find({ week }).sort({ slot: 1 }).toArray();
const tz = project().timezone;
console.log(`[${project().id}] ${week}: ${items.length} items`);
for (const it of items) {
  const when = new Date(it.slot).toLocaleString('nl-NL', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  console.log(`${it.status.padEnd(9)} ${when.padEnd(20)} ${it._id.padEnd(34)} ${it.kind.padEnd(15)} ${(it.spec.platforms || []).join('+')}${it.spec.subject ? `  "${it.spec.subject}"` : ''}`);
  for (const c of it.reviewComments || []) console.log(`          opmerking: ${String(c.text).replace(/\s+/g, ' ').slice(0, 200)}`);
}
await close();
