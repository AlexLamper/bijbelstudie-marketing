// The planner's self-check (no database needed): validates every spec in the project's content/queue/
// (or `samples`, or any folder given),
// pulls the exact verse text, and flags reused or duplicate verses and slot clashes.
// Exit code 1 while anything is wrong, so the planner keeps fixing until it is clean.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import '../env.mjs';
import { project } from '../project.mjs';
import { prepare } from '../spec.mjs';
import { isUsed } from '../verses.mjs';

const P = project();
const arg = process.argv[2];
const dir = !arg ? P.paths.queue : arg === 'samples' ? P.paths.samples : arg;
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'replies.json') : [];
const seenRefs = []; const slots = new Map(); let bad = 0;
// When planning (not for samples): every new item belongs to the target week, revisions keep their own.
const ctx = name => { try { return JSON.parse(readFileSync(join(P.paths.context, name), 'utf8')); } catch { return null; } };
const target = !arg ? ctx('target-week.json') : null;
const revising = new Set((ctx('changes-requested.json') || []).map(c => c.id));
for (const f of files) {
  try {
    const s = await prepare(JSON.parse(readFileSync(join(dir, f), 'utf8')));
    if (`${s.id}.json` !== f) throw new Error(`file name must be ${s.id}.json`);
    if (s.ref) {
      if (isUsed(s.ref)) throw new Error(`${s.ref} was already posted (projects/${P.id}/content/used-verses.json)`);
      if (seenRefs.includes(s.verse.ref)) throw new Error(`${s.ref} is used twice in this batch`);
      seenRefs.push(s.verse.ref);
      if (s.verse.text.length > 260) throw new Error(`${s.ref} is ${s.verse.text.length} chars - pick a verse under 260`);
      if (/^(Een psalm|Een lied|Voor den opperzangmeester|Aleph|Beth|Gimel|Daleth|He\.|Vau|Zain|Cheth|Teth|Jod|Caph|Lamed|Mem|Nun|Samech|Ain|Pe\.|Tsade|Koph|Resch|Schin|Thau)/.test(s.verse.text)) throw new Error(`${s.ref} starts with a heading or acrostic letter - pick another verse`);
    }
    if (target && !revising.has(s.id)) {
      if (s.week !== target.week) throw new Error(`week must be ${target.week} (content/context/target-week.json), not ${s.week}`);
      const dates = target.days.map(d => d.date);
      const local = new Date(s.slot).toLocaleDateString('sv-SE', { timeZone: P.timezone });
      if (!dates.includes(local)) throw new Error(`slot ${s.slot} is not in ${target.week} (${dates[0]} - ${dates[6]})`);
    }
    const key = `${s.slot}|${s.kind.startsWith('reel-') ? 'reel' : 'post'}`;
    if (slots.has(key)) throw new Error(`slot ${s.slot} already used by ${slots.get(key)}`);
    slots.set(key, s.id);
    console.log(`ok   ${f}${s.verse ? `  [${s.verse.ref}: ${s.verse.text.slice(0, 60)}...]` : ''}`);
  } catch (e) { bad++; console.log(`FAIL ${f}: ${e.message.replace(/\s+/g, ' ').slice(0, 600)}`); }
}
console.log(`\n[${P.id}] ${files.length - bad}/${files.length} valid`);
process.exit(bad ? 1 : 0);
