// The planner's self-check (no database needed): validates every spec in the project's content/queue/
// (or `samples`, or any folder given),
// pulls the exact verse text, and flags repeats (verses, subjects, hooks: engine/repeats.mjs) and slot clashes.
// Exit code 1 while anything is wrong, so the planner keeps fixing until it is clean.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import '../env.mjs';
import { project } from '../project.mjs';
import { prepare } from '../spec.mjs';
import { repeatProblems, rowOf } from '../repeats.mjs';
import { screenProblems } from '../screens.mjs';
import { spokenText, traitsOf, formatTolerance } from '../experiments.mjs';

const P = project();
const arg = process.argv[2];
const dir = !arg ? P.paths.queue : arg === 'samples' ? P.paths.samples : arg;
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_') && f !== 'replies.json') : [];
const slots = new Map(); let bad = 0; let weekFails = 0; const planned = [];
const HEADING = /^(Een psalm|Een lied|Een gebed|Een onderwijzing|Voor den opperzangmeester|Aleph|Beth|Gimel|Daleth|He\.|Vau|Zain|Cheth|Teth|Jod|Caph|Lamed|Mem|Nun|Samech|Ain|Pe\.|Tsade|Koph|Resch|Schin|Thau)\b/;
// When planning (not for samples): every new item belongs to the target day (target-week.json `days`,
// one day since the planner runs daily), revisions keep their own.
const ctx = name => { try { return JSON.parse(readFileSync(join(P.paths.context, name), 'utf8')); } catch { return null; } };
const target = !arg ? ctx('target-week.json') : null;
const revising = new Set((ctx('changes-requested.json') || []).map(c => c.id));
const voices = !arg ? ctx('voices.json')?.voices?.map(v => v.key) : null;
const moods = !arg ? ctx('voices.json')?.musicMoods : null;
const allocation = target ? ctx('allocation.json') : null;
// Repeats: against history.json (everything planned or posted, from export-context), the posted verses,
// and the items of this batch that come earlier (so only the later one of a pair has to change).
const samples = arg === 'samples';
const NUMBERED_BOOK = /\b(eerste|tweede|derde|[123]e?)\s+(Samu[eë]l|Koningen|Kronieken|[CK]orinth|Thessalon|Timothe|Petrus|Johannes)/i;
const history = samples ? [] : ctx('history.json')?.items;
if (!samples && !history) console.log('WARN no content/context/history.json (run export-context) - repeats only checked within this batch and against used-verses.json');
const posted = !samples && existsSync(P.paths.usedVerses) ? JSON.parse(readFileSync(P.paths.usedVerses, 'utf8')).verses : [];
const raws = new Map(files.map(f => { try { return [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]; } catch { return [f, null]; } }));
const batchRows = [...raws.values()].filter(r => r?.id).map(r => rowOf(r));
const earlier = (a, b) => (a.slot || '') < (b.slot || '') || ((a.slot || '') === (b.slot || '') && a.id < b.id);
for (const f of files) {
  try {
    const raw = raws.get(f); if (!raw) throw new Error('not valid JSON');
    const s = await prepare(raw);
    if (`${s.id}.json` !== f) throw new Error(`file name must be ${s.id}.json`);
    if (s.ref && s.verse.text.length > 260) throw new Error(`${s.ref} is ${s.verse.text.length} chars - pick a verse under 260`);
    const repeats = repeatProblems(raw, [...(history || []), ...batchRows.filter(r => earlier(r, raw))], posted, { requireSubject: samples || (!!target && !revising.has(s.id)) });
    if (repeats.length) throw new Error(repeats.join(' | '));
    // what Alex asked for (24 Oct 2026): screens that match, one or two calm voices, calm music
    const screens = screenProblems(raw); if (screens.length) throw new Error(screens.join(' | '));
    const speakers = new Set([s.voice, ...(s.cast || []).filter(c => (s.shots || []).some(x => x.by === c.id)).map(c => c.voice)].filter(v => v && v !== 'none'));
    if (s.kind === 'reel-3d' && !(s.shots || []).some(x => x.say)) speakers.delete(s.voice);
    if (speakers.size > 2) throw new Error(`${speakers.size} different voices (${[...speakers].join(', ')}) - Alex wants one, at most two voices per video`);
    const allowedStyles = P.voiceStylesAllowed; if (allowedStyles && s.voiceStyle && !allowedStyles.includes(s.voiceStyle)) throw new Error(`voiceStyle "${s.voiceStyle}" - use ${allowedStyles.join('/')} (calm voices only)`);
    if (P.musicMoods && s.music && s.music !== 'none' && !P.musicMoods.includes(s.music)) throw new Error(`music "${s.music}" - only calm music: ${P.musicMoods.join(', ')}`);
    // Alex, 24 Oct (studio, brand/lessons.md): how a story reel ends, and numbered books said as he says them
    if (!samples && (s.kind === 'reel-story' || s.kind === 'reel-3d')) {
      const lines = (s.kind === 'reel-story' ? [s.hook, ...s.scenes.map(x => x.say)] : (s.shots || []).map(x => x.say)).filter(Boolean).map(l => l.trim());
      const last = lines.at(-1) || '';
      if (!/met uitleg, in de BijbelStudie app[.!]?$/i.test(last)) throw new Error(`the last spoken line must end with "met uitleg, in de BijbelStudie app." (Alex: "lees het met uitleg, in de BijbelStudie app"), not "...${last.slice(-70)}"`);
      const ord = lines.find(l => NUMBERED_BOOK.test(l));
      if (ord) throw new Error(`say numbered books as Alex says them - "één Koningen", "twee Samuël" (in words, not "eerste" or a digit): "${ord.match(NUMBERED_BOOK)[0]}"`);
    }
    // what Alex chose (24 Oct 2026, project.json): only these formats and looks for new items; reels go to every
    // platform, the verse of the day only to instagram + facebook; map stories are told on the map
    if (!revising.has(s.id) && !samples) {
      if (P.formatsAllowed && s.kind !== 'verse-still' && !P.formatsAllowed.includes(s.kind)) throw new Error(`${s.kind} is not made any more - use ${P.formatsAllowed.join(' or ')} (or verse-still for the daily verse)`);
      if (P.stylesAllowed && s.kind.startsWith('reel-') && s.kind !== 'reel-3d' && s.style && !P.stylesAllowed.includes(s.style)) throw new Error(`style "${s.style}" - use ${P.stylesAllowed.join('/')}`);
      if (P.style3dAllowed && s.kind === 'reel-3d' && !P.style3dAllowed.includes(s.style3d || 'lowpoly')) throw new Error(`style3d "${s.style3d || 'lowpoly'}" - use ${P.style3dAllowed.join(' or ')}`);
      const want = s.kind.startsWith('reel-') ? P.platforms : P.platforms.filter(p => p === 'instagram' || p === 'facebook');
      if (want.join() !== P.platforms.filter(p => s.platforms.includes(p)).join() || s.platforms.length !== want.length) throw new Error(`platforms must be ${want.join(', ')} (${s.kind.startsWith('reel-') ? 'every reel goes everywhere' : 'the verse of the day only on instagram and facebook'})`);
      if (P.narratorOnly && s.kind === 'reel-3d' && (s.shots || []).some(x => x.by)) throw new Error('one narrator only (narratorOnly in project.json): no character lines (by + line)');
      if (s.kind === 'reel-story') {
        if (s.scenes.some(x => x.show === 'photo')) throw new Error('no photo scenes in a story reel (Alex: a picture that suddenly appears breaks the map story)');
        const maps = s.scenes.filter(x => x.show === 'map').length;
        if (maps < 3) throw new Error(`${maps} map scenes - a story reel is told on the map: at least 3 map scenes`);
      }
    }
    // every verse shown anywhere in the item (lines, items, scenes, slides, quiz)
    const shown = [s.verse, s.verseData, ...['lines', 'items', 'scenes', 'slides', 'shots'].flatMap(k => (s[k] || []).map(x => x.verseData))].filter(Boolean);
    for (const v of shown) {
      if (HEADING.test(v.text)) throw new Error(`${v.ref} starts with a heading or acrostic letter ("${v.text.slice(0, 24)}...") - pick another verse`);
      if (v !== s.verse && v.text.length > 230) throw new Error(`${v.ref} is ${v.text.length} chars - too long to read in a reel or slide; pick a verse under 230 chars`);
    }
    if (target && !revising.has(s.id)) {
      if (s.week !== target.week) throw new Error(`week must be ${target.week} (content/context/target-week.json), not ${s.week}`);
      if (target.idPrefix && !s.id.startsWith(`${target.idPrefix}-`)) throw new Error(`id must start with ${target.idPrefix}- (idPrefix in content/context/target-week.json)`);
      const dates = target.days.map(d => d.date);
      const local = new Date(s.slot).toLocaleDateString('sv-SE', { timeZone: P.timezone });
      if (!dates.includes(local)) throw new Error(`slot ${s.slot} is on ${local}, not on the day to plan (${dates.join(', ')}; content/context/target-week.json)`);
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
// The planned day(s) as a whole: the recipe (reels per day), formats per allocation.json (exact for a day,
// within 1 for a week), the feed posts, the voice budget.
if (allocation && planned.length) {
  const fails = [], warns = [];
  const day = sp => new Date(sp.slot).toLocaleDateString('sv-SE', { timeZone: P.timezone });
  const reels = planned.filter(x => x.kind.startsWith('reel-'));
  const isMain = x => x.platforms.includes('instagram') || x.platforms.includes('facebook');
  const main = reels.filter(isMain), extra = reels.filter(x => !isMain(x));
  const R = allocation.recipe;
  for (const d of target.days.map(d => d.date)) {
    const v = planned.filter(x => x.kind === 'verse-still' && day(x) === d).length;
    if (v !== 1) fails.push(`${d}: ${v} verse-still - every day has exactly one verse of the day`);
    const m = main.filter(x => day(x) === d).length, e = extra.filter(x => day(x) === d).length;
    if (m !== R.mainPerDay) fails.push(`${d}: ${m} main reels (instagram/facebook/tiktok/youtube), the recipe wants ${R.mainPerDay}`);
    if (e !== R.extraPerDay) fails.push(`${d}: ${e} extra reels (tiktok + youtube only), the recipe wants ${R.extraPerDay}`);
  }
  const count = (list, key = x => x.kind) => list.reduce((o, x) => { const k = key(x); o[k] = (o[k] || 0) + 1; return o; }, {});
  // tol: how far a count may be off. Format groups of one day (1-3 slots) must match exactly - within 1
  // would let any format fill a 1-slot group; soft targets stay within 1 (warnings only).
  const compare = (name, have, want, tol, hard) => {
    for (const k of new Set([...Object.keys(have), ...Object.keys(want)])) {
      const h = have[k] || 0, w = want[k] || 0;
      if (Math.abs(h - w) > tol) (hard ? fails : warns).push(`${name} ${k}: ${h} planned, allocation.json says ${w} (${tol ? `within ${tol} is fine` : 'must match'})`);
    }
  };
  const group = (name, have, g) => compare(name, have, g.format, formatTolerance(g.slots), true);
  group('main reels format', count(main), allocation.mainReels);
  group('extra reels format', count(extra), allocation.extraReels);
  const feed = planned.filter(x => ['post-spotlight', 'post-statement', 'carousel'].includes(x.kind));
  group('feed posts format', count(feed), allocation.feedPosts);
  if (feed.length !== allocation.feedPosts.slots) fails.push(`${feed.length} feed posts planned, allocation.json wants ${allocation.feedPosts.slots}`);
  for (const [trait, want] of Object.entries(allocation.targets || {})) if (!['voiceStyle', 'captions', 'style3d'].includes(trait)) compare(`target ${trait}`, count(planned.filter(x => traitsOf(x)[trait] != null), x => traitsOf(x)[trait]), want, 1, false);
  if (allocation.voiceBudget) {
    const chars = planned.reduce((n, x) => n + spokenText(x).length, 0), max = allocation.voiceBudget.charsForDay;
    if (chars > max) fails.push(`voiced text is ${chars} characters, the voice budget for this day is ${max} (voiceBudget.charsForDay) - shorten lines or use formats without voice`);
    else console.log(`voice budget: ${chars} of ${max} characters for this day`);
  }
  warns.forEach(w => console.log(`WARN ${w}`));
  fails.forEach(f => console.log(`FAIL day: ${f}`));
  weekFails = fails.length;
}
console.log(`\n[${P.id}] ${files.length - bad}/${files.length} valid${weekFails ? `, ${weekFails} day problem${weekFails > 1 ? 's' : ''}` : ''}${bad || weekFails ? ' - fix every FAIL above' : ''}`);
process.exit(bad || weekFails ? 1 : 0);
