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
import { spokenText, traitsOf } from '../experiments.mjs';

const P = project();
const arg = process.argv[2];
const dir = !arg ? P.paths.queue : arg === 'samples' ? P.paths.samples : arg;
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'replies.json') : [];
const seenRefs = []; const slots = new Map(); let bad = 0; const planned = [];
const HEADING = /^(Een psalm|Een lied|Een gebed|Een onderwijzing|Voor den opperzangmeester|Aleph|Beth|Gimel|Daleth|He\.|Vau|Zain|Cheth|Teth|Jod|Caph|Lamed|Mem|Nun|Samech|Ain|Pe\.|Tsade|Koph|Resch|Schin|Thau)\b/;
// When planning (not for samples): every new item belongs to the target week, revisions keep their own.
const ctx = name => { try { return JSON.parse(readFileSync(join(P.paths.context, name), 'utf8')); } catch { return null; } };
const target = !arg ? ctx('target-week.json') : null;
const revising = new Set((ctx('changes-requested.json') || []).map(c => c.id));
const voices = !arg ? ctx('voices.json')?.voices?.map(v => v.key) : null;
const moods = !arg ? ctx('voices.json')?.musicMoods : null;
const allocation = target ? ctx('allocation.json') : null;
for (const f of files) {
  try {
    const s = await prepare(JSON.parse(readFileSync(join(dir, f), 'utf8')));
    if (`${s.id}.json` !== f) throw new Error(`file name must be ${s.id}.json`);
    if (s.ref) {
      if (isUsed(s.ref)) throw new Error(`${s.ref} was already posted (projects/${P.id}/content/used-verses.json)`);
      if (seenRefs.includes(s.verse.ref)) throw new Error(`${s.ref} is used twice in this batch`);
      seenRefs.push(s.verse.ref);
      if (s.verse.text.length > 260) throw new Error(`${s.ref} is ${s.verse.text.length} chars - pick a verse under 260`);
    }
    // every verse shown anywhere in the item (lines, items, scenes, slides, quiz)
    const shown = [s.verse, s.verseData, ...['lines', 'items', 'scenes', 'slides'].flatMap(k => (s[k] || []).map(x => x.verseData))].filter(Boolean);
    for (const v of shown) {
      if (HEADING.test(v.text)) throw new Error(`${v.ref} starts with a heading or acrostic letter ("${v.text.slice(0, 24)}...") - pick another verse`);
      if (v !== s.verse && v.text.length > 230) throw new Error(`${v.ref} is ${v.text.length} chars - too long to read in a reel or slide; pick a verse under 230 chars`);
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
    if (moods && s.music && s.music !== 'none' && !moods.includes(s.music)) throw new Error(`music "${s.music}" is not in the music library - use one of: ${moods.join(', ') || '(none yet: leave music out)'} (content/context/voices.json)`);
    if (voices && s.voice && s.voice !== 'none' && !voices.includes(s.voice)) throw new Error(`voice "${s.voice}" is not available - use one of: ${voices.join(', ')} (content/context/voices.json)`);
    if (target && !revising.has(s.id)) planned.push(s);
    console.log(`ok   ${f}${s.verse ? `  [${s.verse.ref}: ${s.verse.text.slice(0, 60)}...]` : ''}`);
  } catch (e) { bad++; console.log(`FAIL ${f}: ${e.message.replace(/\s+/g, ' ').slice(0, 600)}`); }
}
// The week as a whole: the recipe (reels per day), formats per allocation.json, the voice budget.
if (allocation && planned.length) {
  const fails = [], warns = [];
  const day = sp => new Date(sp.slot).toLocaleDateString('sv-SE', { timeZone: P.timezone });
  const reels = planned.filter(x => x.kind.startsWith('reel-'));
  const isMain = x => x.platforms.includes('instagram') || x.platforms.includes('facebook');
  const main = reels.filter(isMain), extra = reels.filter(x => !isMain(x));
  const R = allocation.recipe;
  for (const d of target.days.map(d => d.date)) {
    const m = main.filter(x => day(x) === d).length, e = extra.filter(x => day(x) === d).length;
    if (m !== R.mainPerDay) fails.push(`${d}: ${m} main reels (instagram/facebook/tiktok/youtube), the recipe wants ${R.mainPerDay}`);
    if (e !== R.extraPerDay) fails.push(`${d}: ${e} extra reels (tiktok + youtube only), the recipe wants ${R.extraPerDay}`);
  }
  const count = (list, key = x => x.kind) => list.reduce((o, x) => { const k = key(x); o[k] = (o[k] || 0) + 1; return o; }, {});
  const compare = (name, have, want, hard) => {
    for (const k of new Set([...Object.keys(have), ...Object.keys(want)])) {
      const h = have[k] || 0, w = want[k] || 0;
      if (Math.abs(h - w) > 1) (hard ? fails : warns).push(`${name} ${k}: ${h} planned, allocation.json says ${w} (within 1 is fine)`);
    }
  };
  compare('main reels format', count(main), allocation.mainReels.format, true);
  compare('extra reels format', count(extra), allocation.extraReels.format, true);
  const feed = planned.filter(x => ['post-spotlight', 'post-statement', 'carousel'].includes(x.kind));
  compare('feed posts format', count(feed), allocation.feedPosts.format, true);
  for (const [trait, want] of Object.entries(allocation.targets || {})) compare(`target ${trait}`, count(planned.filter(x => traitsOf(x)[trait] != null), x => traitsOf(x)[trait]), want, false);
  if (allocation.voiceBudget) {
    const chars = planned.reduce((n, x) => n + spokenText(x).length, 0);
    if (chars > allocation.voiceBudget.charsThisWeek) fails.push(`voiced text is ${chars} characters, the voice budget this week is ${allocation.voiceBudget.charsThisWeek} - shorten lines or use formats without voice`);
    else console.log(`voice budget: ${chars} of ${allocation.voiceBudget.charsThisWeek} characters`);
  }
  warns.forEach(w => console.log(`WARN ${w}`));
  fails.forEach(f => console.log(`FAIL week: ${f}`));
  bad += fails.length;
}
console.log(`\n[${P.id}] ${files.length - bad}/${files.length} valid${bad ? ' - fix every FAIL above' : ''}`);
process.exit(bad ? 1 : 0);
