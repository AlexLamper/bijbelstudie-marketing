// No repeats. Checks a planned item against everything that was planned or posted before
// (content/context/history.json, written by export-context) and against the rest of the batch:
//   - a main verse (verse-still / reel-verse "ref") is never used again, as main verse or anywhere else
//     within VERSE_DAYS; a posted main verse (used-verses.json) is never a main verse again
//   - any verse shown in an item (lines, items, scenes, slides, quiz) is not shown again within VERSE_DAYS
//   - the subject (what the item is about) is not repeated within SUBJECT_WEEKS (app/praktisch topics:
//     APP_SUBJECT_WEEKS - there are only so many features), and never twice in one week
//   - the hook (first line) is not the same or nearly the same as one used within HOOK_WEEKS
// Verse ranges count as the same when they overlap (Psalmen 23:1 and Psalmen 23:1-3).
import { parseRef, getVerse } from './verses.mjs';

export const VERSE_DAYS = 180, SUBJECT_WEEKS = 12, APP_SUBJECT_WEEKS = 4, HOOK_WEEKS = 26;
export const NO_SUBJECT = ['verse-still', 'reel-verse'];   // the verse is the subject

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(('de het een en in op te van voor met aan over bij uit is was wat wie waarom hoe waar wanneer je jij jouw jou u uw ik we wij ons onze hij zij ze zijn haar hun dit dat die deze daar hier er '
  + 'niet geen ook als of om naar door tot dan maar nog al wel zo heel echt toch eens even meer veel weet wist dingen ding boek verhaal').split(' '));
const tokens = s => fold(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(t => t && !STOP.has(t));
const days = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;

/** Every verse an item shows: [{ ref, main }]. Works on raw specs (refs as written). */
export function versesOf(s) {
  const out = [];
  if (s.ref) out.push({ ref: s.ref, main: true });
  if (s.verseRef) out.push({ ref: s.verseRef, main: false });
  for (const k of ['lines', 'items', 'scenes', 'slides']) for (const x of s[k] || []) if (x.verse) out.push({ ref: x.verse, main: false });
  return out;
}
/** The first line a viewer reads or hears (null for verse items: their verse is checked instead). */
export const hookOf = s => NO_SUBJECT.includes(s.kind) ? null : s.hook || s.question || s.headline || s.line || s.slides?.[0]?.title || null;

const canon = new Map();
const range = ref => {
  if (!canon.has(ref)) {
    let r = null;
    try { const v = getVerse(ref); r = { book: v.book, chapter: v.verses.length ? parseRef(v.ref).chapter : 0, from: v.verses[0].n, to: v.verses.at(-1).n }; }
    catch { try { const p = parseRef(ref); r = { book: fold(p.book).trim(), chapter: p.chapter, from: p.from, to: p.to }; } catch { /* not a reference */ } }
    canon.set(ref, r);
  }
  return canon.get(ref);
};
/** Same book and chapter with overlapping verses (book names via the Statenvertaling data, so aliases match). */
export function overlaps(a, b) {
  const x = range(a), y = range(b);
  return !!x && !!y && x.book === y.book && x.chapter === y.chapter && x.from <= y.to && y.from <= x.to;
}
/** Same subject: equal after folding, or one subject's words all inside the other's ("Ruth" / "Het boek Ruth"). */
export function sameSubject(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return fold(a).trim() === fold(b).trim();
  const [small, big] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  return small.every(t => big.has(t));
}
/** Same or nearly the same hook: equal after folding, or 70% of the words shared (Jaccard). */
export function similarHook(a, b) {
  const fa = fold(a).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(), fb = fold(b).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (fa === fb) return true;
  const x = new Set(tokens(a)), y = new Set(tokens(b));
  if (x.size < 2 || y.size < 2) return false;
  const shared = [...x].filter(t => y.has(t)).length;
  return shared / (x.size + y.size - shared) >= 0.7;
}

/** A history row for an item: what export-context writes and what the batch is compared as. */
export const rowOf = (s, extra = {}) => ({ id: s.id, week: s.week, kind: s.kind, slot: s.slot, subject: s.subject || null, topic: s.experiment?.topic || null, hook: hookOf(s), verses: versesOf(s), ...extra });

/**
 * Problems with spec `s` (array of strings, empty = fine).
 * others: history rows + the rest of the batch (rows, same id is skipped); posted: [{ ref, date }] from used-verses.json.
 */
export function repeatProblems(s, others, posted = [], { requireSubject = true } = {}) {
  const out = [], me = rowOf(s), rows = others.filter(o => o.id !== s.id);
  const when = o => o.week === s.week ? 'this week' : `${o.week || 'earlier'}`;
  for (const v of me.verses) {
    if (v.main) {
      const p = posted.find(u => overlaps(u.ref, v.ref));
      if (p) out.push(`${v.ref} was already posted${p.date ? ` (${String(p.date).slice(0, 10)})` : ''} - a verse of the day is never reused; pick another`);
      const o = rows.find(o => o.verses?.some(u => u.main && overlaps(u.ref, v.ref)));
      if (o) out.push(`${v.ref} is already the verse of ${o.id} (${when(o)}) - pick another`);
    }
    const near = rows.find(o => o.verses?.some(u => overlaps(u.ref, v.ref)) && (!o.slot || !s.slot || days(o.slot, s.slot) < VERSE_DAYS));
    if (near && !out.some(x => x.startsWith(v.ref))) out.push(`${v.ref} is already shown in ${near.id} (${when(near)}) - no verse twice within ${VERSE_DAYS} days; pick another`);
    if (!v.main) { const p = posted.find(u => overlaps(u.ref, v.ref) && (!u.date || days(u.date, s.slot) < VERSE_DAYS)); if (p) out.push(`${v.ref} was the verse of the day on ${String(p.date || '').slice(0, 10) || 'an earlier day'} - not again within ${VERSE_DAYS} days; pick another`); }
  }
  if (!NO_SUBJECT.includes(s.kind)) {
    if (!s.subject) { if (requireSubject) out.push('subject is missing - say in a few words what this item is about (e.g. "Ruth", "Paulus in Athene", "Leesplannen")'); }
    else {
      const weeks = ['app', 'praktisch'].includes(s.experiment?.topic) ? APP_SUBJECT_WEEKS : SUBJECT_WEEKS;
      const o = rows.find(o => o.subject && sameSubject(o.subject, s.subject) && (o.week === s.week || !o.slot || days(o.slot, s.slot) < weeks * 7));
      if (o) out.push(`subject "${s.subject}" repeats ${o.id} ("${o.subject}", ${when(o)}) - same subject not within ${weeks} weeks and never twice in a week; pick another`);
    }
  }
  const h = me.hook;
  if (h) {
    const o = rows.find(o => o.hook && similarHook(o.hook, h) && (!o.slot || days(o.slot, s.slot) < HOOK_WEEKS * 7));
    if (o) out.push(`hook "${h}" is (nearly) the same as ${o.id}: "${o.hook}" - write a new one`);
  }
  return out;
}

/** History rows from item documents (Mongo items): everything planned or posted except rejected items. */
export const historyFrom = items => items.filter(it => it.status !== 'rejected' && it.spec).map(it => rowOf(it.spec, { status: it.status }));
