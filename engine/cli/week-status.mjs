// Prints a week's items: id, kind, status, slot, platforms, Alex's comments (run via maintenance.yml).
//   node engine/cli/week-status.mjs 2026-W45
import '../env.mjs';
import { db, close } from '../db.mjs';
import { project } from '../project.mjs';

//   node engine/cli/week-status.mjs pile        the pile and what is (being) posted: approved, partial, failed
//                                              and published in the last 3 days, with postAt, results, history
const week = process.argv[2]; if (!week) { console.error('usage: week-status.mjs <YYYY-Www> | pile'); process.exit(2); }
const d = await db();
const pile = week === 'pile';
const items = await d.collection('items').find(pile
  ? { $or: [{ status: { $in: ['approved', 'partial'] } }, { status: { $in: ['published', 'failed'] }, updatedAt: { $gte: new Date(Date.now() - 3 * 864e5) } }, { publishedAt: { $gte: new Date(Date.now() - 3 * 864e5) } }] }
  : { week }).sort({ slot: 1 }).toArray();
const tz = project().timezone;
console.log(`[${project().id}] ${week}: ${items.length} items`);
const at = t => t ? new Date(t).toLocaleString('nl-NL', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
if (pile) for (const it of items) {
  console.log(`${it.status.padEnd(9)} ${it._id.padEnd(34)} ${it.kind.padEnd(14)} postAt ${at(it.postAt)} (${typeof it.postAt}${it.postAt instanceof Date ? ' Date' : ''})  approvedAt ${at(it.approvedAt)}  platforms ${(it.spec.platforms || []).join('+')}`);
  console.log(`          results ${JSON.stringify(it.results || {}).slice(0, 400)}`);
  for (const h of (it.history || []).slice(-5)) console.log(`          ${at(h.at)} ${h.event}${h.note ? ` - ${String(h.note).slice(0, 120)}` : ''}${h.via ? ` (${h.via})` : ''}`);
}
if (pile) { const runs = await d.collection('runs').find().toArray(); for (const r of runs) console.log(`run ${r._id}: ${at(r.at)} ${JSON.stringify(r.summary || r).slice(0, 300)}`); await close(); process.exit(0); }
for (const it of items) {
  const when = new Date(it.slot).toLocaleString('nl-NL', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  console.log(`${it.status.padEnd(9)} ${when.padEnd(20)} ${it._id.padEnd(34)} ${it.kind.padEnd(15)} ${(it.spec.platforms || []).join('+')}${it.spec.subject ? `  "${it.spec.subject}"` : ''}`);
  if (process.argv.includes('--media') && it.media?.url) console.log(`          ${it.media.url}${it.media.duration ? ` (${it.media.duration.toFixed(1)} s)` : ''}`);
  if (it.error) console.log(`          fout: ${String(it.error).slice(0, 200)}`);
  for (const c of it.reviewComments || []) console.log(`          opmerking: ${String(c.text).replace(/\s+/g, ' ').slice(0, 200)}`);
}
await close();
