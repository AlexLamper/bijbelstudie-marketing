// When an approved item goes online. Items are posted on approval, not on the planner's date:
// approving an item gives it the next free posting time from now, in the project's time zone,
// one item per time per day. A time is taken when another approved, published or partly published
// item already has it. publish-due then posts approved items whose slot has passed.
//
// Mirrored in engine/slots.mjs (plain JS for the engine jobs) - keep the two the same.
// Pure functions, no Node or browser APIs beyond Intl, so pages and API routes can share them.

export type SlotGroup = 'verse' | 'feed' | 'main' | 'extra';
export type Ymd = { y: number; m: number; d: number };

/** Local posting times per group, earliest first. */
export const POSTING_TIMES: Record<SlotGroup, string[]> = {
  verse: ['07:00'],          // verse-still (instagram + facebook)
  feed: ['12:00'],           // post-spotlight, post-statement, carousel (instagram + facebook)
  extra: ['12:30', '17:00'], // reels only on tiktok/youtube
  main: ['19:30'],           // reels that also go to instagram/facebook
};

/** Statuses whose slot blocks that time for other items. */
export const TAKES_SLOT = ['approved', 'published', 'partial'];

export const DEFAULT_TZ = 'Europe/Amsterdam';

export function slotGroup(kind: string, platforms: string[] = []): SlotGroup {
  if (kind === 'verse-still') return 'verse';
  if (kind.startsWith('reel-')) return platforms.some(p => p === 'instagram' || p === 'facebook') ? 'main' : 'extra';
  return 'feed';
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function wallClock(t: number, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    fmtCache.set(tz, f);
  }
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(t))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
}

/** Offset of `tz` from UTC at instant t, in minutes (Amsterdam: 60 in winter, 120 in summer). */
export function offsetMinutes(t: number, tz: string): number {
  const w = wallClock(t, tz);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000) / 60000);
}

/** The calendar date at instant `at` in `tz`. */
export function localDate(at: Date | string | number, tz: string): Ymd {
  const w = wallClock(new Date(at).getTime(), tz);
  return { y: w.y, m: w.m, d: w.d };
}

export function addDays({ y, m, d }: Ymd, n: number): Ymd {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** The instant that is wall time `hhmm` on local date `ymd` in `tz` (DST-safe). */
export function zonedTime(ymd: Ymd, hhmm: string, tz: string): Date {
  const [hh, mm] = hhmm.split(':').map(Number);
  const wall = Date.UTC(ymd.y, ymd.m - 1, ymd.d, hh, mm);
  const first = wall - offsetMinutes(wall, tz) * 60000;
  return new Date(wall - offsetMinutes(first, tz) * 60000);   // second pass when the guess crossed a DST change
}

/** ISO 8601 with the local offset, e.g. 2026-10-24T19:30:00+02:00 (what spec.slot holds). */
export function isoWithOffset(at: Date, tz: string): string {
  const t = at.getTime(); const w = wallClock(t, tz); const off = offsetMinutes(t, tz); const a = Math.abs(off);
  return `${w.y}-${pad(w.m)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** ISO week of a calendar date, e.g. 2026-W43. */
export function isoWeekOf({ y, m, d }: Ymd): string {
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const yy = t.getUTCFullYear(); const w = Math.ceil(((t.getTime() - Date.UTC(yy, 0, 1)) / 864e5 + 1) / 7);
  return `${yy}-W${pad(w)}`;
}

const minuteKey = (x: Date | string | number) => Math.floor(new Date(x).getTime() / 60000);

export type Slot = { at: Date; iso: string; week: string; date: Ymd; time: string };

/**
 * The next free posting time after `now` for an item of this kind and these platforms.
 * taken: slots of the other approved/published/partial items. Today's times that have passed
 * or are taken roll over to the next day, and so on.
 */
export function nextFreeSlot(kind: string, platforms: string[], taken: Iterable<Date | string | number>,
  { now = new Date(), tz = DEFAULT_TZ, maxDays = 366 }: { now?: Date; tz?: string; maxDays?: number } = {}): Slot {
  const times = POSTING_TIMES[slotGroup(kind, platforms)];
  const busy = new Set<number>(); for (const x of taken) if (x != null) busy.add(minuteKey(x));
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

// ---- Dutch labels (fixed tables, so the server and the browser print the same)
const WEEKDAY = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTH = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** Calendar days from today to `at` in `tz` (0 = today, 1 = tomorrow, -1 = yesterday). */
export function daysFromToday(at: Date | string | number, { now = new Date(), tz = DEFAULT_TZ } = {}): number {
  const a = localDate(at, tz), b = localDate(now, tz);
  return Math.round((Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d)) / 864e5);
}

export function localTime(at: Date | string | number, tz = DEFAULT_TZ): string {
  const w = wallClock(new Date(at).getTime(), tz);
  return `${pad(w.h)}:${pad(w.mi)}`;
}

/** "za 24 okt" */
export function localDay(at: Date | string | number, tz = DEFAULT_TZ): string {
  const { y, m, d } = localDate(at, tz);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH[m - 1]}`;
}

/** "Vandaag 19:30", "Morgen 07:00", "Gisteren 12:00", "di 27 okt 12:30" */
export function slotLabel(at: Date | string | number, opts: { now?: Date; tz?: string } = {}): string {
  const tz = opts.tz || DEFAULT_TZ; const k = daysFromToday(at, { ...opts, tz }); const time = localTime(at, tz);
  return k === 0 ? `Vandaag ${time}` : k === 1 ? `Morgen ${time}` : k === -1 ? `Gisteren ${time}` : `${localDay(at, tz)} ${time}`;
}

/** "Gaat vandaag om 19:30 online", "Gaat morgen om 07:00 online", "Gaat op di 27 okt om 12:30 online" */
export function slotMessage(at: Date | string | number, opts: { now?: Date; tz?: string } = {}): string {
  const tz = opts.tz || DEFAULT_TZ; const k = daysFromToday(at, { ...opts, tz }); const time = localTime(at, tz);
  return `Gaat ${k === 0 ? 'vandaag' : k === 1 ? 'morgen' : `op ${localDay(at, tz)}`} om ${time} online`;
}

/** The posting times an item of this kind would get, for the review card: "19:30", "12:30 of 17:00". */
export function postingTimesText(kind: string, platforms: string[] = []): string {
  const t = POSTING_TIMES[slotGroup(kind, platforms)];
  return t.length > 1 ? `${t.slice(0, -1).join(', ')} of ${t[t.length - 1]}` : t[0];
}
