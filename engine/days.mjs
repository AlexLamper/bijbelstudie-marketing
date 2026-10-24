// Calendar days in the project's timezone, for planning one day at a time (export-context, render notices).
// A day is a local date string YYYY-MM-DD. Arithmetic runs on that calendar date, never on instants,
// so summer/winter time cannot shift a day.

export const DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const parts = date => date.split('-').map(Number);
const utcNoon = date => { const [y, m, d] = parts(date); return new Date(Date.UTC(y, m - 1, d, 12)); };

/** The local date (YYYY-MM-DD) of an instant in timezone tz. */
export const localDate = (at, tz) => new Date(at).toLocaleDateString('sv-SE', { timeZone: tz });
/** date + n calendar days. */
export const addDays = (date, n) => { const t = utcNoon(date); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
/** Whole calendar days from a to b. */
export const daysBetween = (a, b) => Math.round((utcNoon(b) - utcNoon(a)) / 864e5);
/** mon ... sun */
export const dayName = date => DAY_NAMES[(utcNoon(date).getUTCDay() + 6) % 7];

/** ISO week of a calendar date, e.g. 2026-W46. */
export function isoWeekOf(date) {
  const [y0, m, d] = parts(date);
  const t = new Date(Date.UTC(y0, m - 1, d)); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}

/** UTC offset of tz on that date (at 12:00 UTC, after any summer/winter switch at night), e.g. +01:00. */
export const utcOffset = (date, tz) => new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'longOffset' })
  .formatToParts(utcNoon(date)).find(x => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';

/**
 * The day to plan: the first local date from tomorrow on that has no item yet.
 * slots: the slots (Date or ISO string) of existing items; a day has items when any slot falls on it.
 */
export function dayTarget(slots, { now = new Date(), tz = 'Europe/Amsterdam' } = {}) {
  const today = localDate(now, tz);
  const planned = new Set(slots.map(s => localDate(s, tz)).filter(d => d > today));
  let date = addDays(today, 1);
  while (planned.has(date)) date = addDays(date, 1);
  const week = isoWeekOf(date), day = dayName(date);
  return { today, date, day, week, idPrefix: `${week.toLowerCase()}-${day}`, utcOffset: utcOffset(date, tz), daysAhead: daysBetween(today, date), plannedDays: [...planned].sort() };
}
