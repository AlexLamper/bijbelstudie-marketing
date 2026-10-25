// The posting rhythm. Alex approves items onto one pile (no dates); every day each posting time below
// takes the next approved item of its type from the pile, the one approved longest ago first, and the
// publish job (engine/cli/publish-due.mjs) posts it. One item per time per day, in the project's time zone.
// A time stays open for WINDOW_MIN minutes, so a publish run that comes a little late still uses it, and
// an item approved in the evening can still go out at 19:30 that same evening.
// Alex, 24 Oct: the verse of the day only on Instagram and Facebook; every reel he approves on all platforms.
// Alex, 25 Oct: two reels a day (the planner makes two a day, recipe.reelsPerDay), at 12:00 and 19:30.
//   verse-still                                   07:00          instagram, facebook
//   post-spotlight / post-statement / carousel    12:00          instagram, facebook (none are planned now)
//   reels                                         12:00, 19:30   every platform of the project

export const POSTING_TIMES = {
  verse: ['07:00'],
  feed: ['12:00'],
  reel: ['12:00', '19:30'],
};

/** The platforms an item goes to when it is posted: reels everywhere, the rest only where images live. */
export function postPlatforms(kind, projectPlatforms) {
  if (kind.startsWith('reel-')) return [...projectPlatforms];
  return projectPlatforms.filter(p => p === 'instagram' || p === 'facebook');
}

export const WINDOW_MIN = 180;

export function slotGroup(kind) {
  if (kind === 'verse-still') return 'verse';
  if (kind.startsWith('reel-')) return 'reel';
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

const WEEKDAY = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTH = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** "za 24 okt" */
export function localDay(at, tz) {
  const { y, m, d } = localDate(at, tz);
  return `${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTH[m - 1]}`;
}

/** Posting times that are open now: today's times from `at` until WINDOW_MIN minutes later. [{ group, time, at, iso, week }] */
export function openTimes({ now = new Date(), tz = 'Europe/Amsterdam' } = {}) {
  const today = localDate(now, tz); const out = [];
  for (const [group, times] of Object.entries(POSTING_TIMES)) for (const time of times) {
    const at = zonedTime(today, time, tz);
    if (at.getTime() <= now.getTime() && now.getTime() < at.getTime() + WINDOW_MIN * 60e3) out.push({ group, time, at, iso: isoWithOffset(at, tz), week: isoWeekOf(today) });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** When Alex approved an item (latest approval; older items: from their history). */
export function approvedAt(it) {
  if (it.approvedAt) return +new Date(it.approvedAt);
  const ev = (it.history || []).filter(h => h.event === 'approve' || h.event === 'approve-all').map(h => +new Date(h.at));
  return ev.length ? Math.max(...ev) : +new Date(it.updatedAt || it.createdAt || 0);
}
