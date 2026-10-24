// When an approved item goes online (engine copy of the studio's lib/postingSlots.ts - keep the two
// the same). Items are posted on approval, not on the planner's date: an approved item gets the next
// free posting time from now, in the project's time zone, one item per time per day. A time is taken
// when another approved, published or partly published item already has it.
//   verse-still                                   07:00
//   post-spotlight / post-statement / carousel    12:00
//   reels that go to instagram/facebook ("main")  19:30
//   reels only on tiktok/youtube ("extra")        12:30, 17:00

export const POSTING_TIMES = {
  verse: ['07:00'],
  feed: ['12:00'],
  extra: ['12:30', '17:00'],
  main: ['19:30'],
};

/** Statuses whose slot blocks that time for other items. */
export const TAKES_SLOT = ['approved', 'published', 'partial'];

export function slotGroup(kind, platforms = []) {
  if (kind === 'verse-still') return 'verse';
  if (kind.startsWith('reel-')) return platforms.some(p => p === 'instagram' || p === 'facebook') ? 'main' : 'extra';
  return 'feed';
}

const pad = n => String(n).padStart(2, '0');
const fmtCache = new Map();
function wallClock(t, tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(new Date(t))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}

/** Offset of `tz` from UTC at instant t, in minutes (Amsterdam: 60 in winter, 120 in summer). */
export function offsetMinutes(t, tz) {
  const w = wallClock(t, tz);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000) / 60000);
}

export function localDate(at, tz) {
  const w = wallClock(new Date(at).getTime(), tz);
  return { y: w.y, m: w.m, d: w.d };
}

export function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** The instant that is wall time `hhmm` on local date `ymd` in `tz` (DST-safe). */
export function zonedTime(ymd, hhmm, tz) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const wall = Date.UTC(ymd.y, ymd.m - 1, ymd.d, hh, mm);
  const first = wall - offsetMinutes(wall, tz) * 60000;
  return new Date(wall - offsetMinutes(first, tz) * 60000);
}

/** ISO 8601 with the local offset, e.g. 2026-10-24T19:30:00+02:00 (what spec.slot holds). */
export function isoWithOffset(at, tz) {
  const t = at.getTime(); const w = wallClock(t, tz); const off = offsetMinutes(t, tz); const a = Math.abs(off);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function isoWeekOf({ y, m, d }) {
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const yy = t.getUTCFullYear(); const w = Math.ceil(((t.getTime() - Date.UTC(yy, 0, 1)) / 864e5 + 1) / 7);
  return `${yy}-W${pad(w)}`;
}

const minuteKey = x => Math.floor(new Date(x).getTime() / 60000);

/** The next free posting time after `now`: { at, iso, week, date, time }. */
export function nextFreeSlot(kind, platforms, taken, { now = new Date(), tz = 'Europe/Amsterdam', maxDays = 366 } = {}) {
  const times = POSTING_TIMES[slotGroup(kind, platforms)];
  const busy = new Set(); for (const x of taken) if (x != null) busy.add(minuteKey(x));
  const today = localDate(now, tz);
  for (let k = 0; k < maxDays; k++) {
    const date = addDays(today, k);
    for (const time of times) {
      const at = zonedTime(date, time, tz);
      if (at.getTime() > now.getTime() && !busy.has(minuteKey(at))) return { at, iso: isoWithOffset(at, tz), week: isoWeekOf(date), date, time };
    }
  }
  throw new Error(`no free posting time in the next ${maxDays} days`);
}

const WEEKDAY = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTH = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "za 24 okt" */
export function localDay(at, tz) {
  const { y, m, d } = localDate(at, tz);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH[m - 1]}`;
}

/** $set fields for a scheduled item: the slot itself, and the week it now belongs to. */
export const slotFields = slot => ({ slot: slot.at, 'spec.slot': slot.iso, week: slot.week, 'spec.week': slot.week });

/** The history event that records the posting time (local time in the note). */
export const scheduledEvent = (slot, tz, at) => ({ at, event: 'scheduled', note: `${localDay(slot.at, tz)} ${slot.time}` });
