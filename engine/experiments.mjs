// What we test and how the slots of the next day to plan are divided.
//
// 1. Traits: every item has traits (format, look, voice, voice style, music, subtitles, hook, topic,
//    length, time). Most are read from the spec itself, so the planner cannot mislabel them.
// 2. Fair score per item and platform, once it has been online for 48 hours: its views compared with
//    the median of the same platform and media type (reel or post) over the last 8 weeks, and its
//    engagement (likes, comments, shares, saves per view) compared the same way. 2x the median views
//    = 0.75, 4x = 1, half = 0.25. score = 0.6 * views part + 0.4 * engagement part, from 0 to 1;
//    where the platform reports watch time: 0.45 views + 0.3 engagement + 0.25 share watched.
// 3. Per trait value a Beta(1 + sum of scores, 1 + sum of (1 - score)) belief; Thompson sampling gives
//    the chance that each value is the best. The day's slots: a fixed share for exploring (spread
//    evenly, so new things keep getting tried) + the rest in proportion to that chance. A day has only
//    a few slots per group, so the remainders are drawn at random (seeded per day) in proportion to
//    their size: over the days every value gets its share instead of the leader taking every slot.
import { HOOKS, TOPICS, STYLES, STYLES3D, MOODS, CAPTIONS, VOICE_STYLES, REEL_KINDS, VOICE_REQUIRED, RENDERABLE, isVideo } from './spec.mjs';

export const POST_KINDS = ['post-spotlight', 'post-statement', 'carousel'];
export const DEFAULT_STYLE = { 'reel-explainer': 'light', 'reel-demo': 'light', 'reel-verse': 'photo', 'reel-kinetic': 'dark', 'reel-quiz': 'light', 'reel-list': 'light', 'reel-story': 'dark', carousel: 'light' };
const hasVoice = s => !!s.voice && s.voice !== 'none';
const bucket = d => d < 15 ? '<15s' : d < 30 ? '15-30s' : d < 45 ? '30-45s' : '45s+';
const localTime = (iso, tz = 'Europe/Amsterdam') => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

/** Trait name -> { label, of(spec, item) }. A null value = the trait does not apply to this item. */
export const TRAITS = {
  format: { label: 'Formaat', of: s => s.kind },
  style: { label: 'Look', of: s => (isVideo(s.kind) || s.kind === 'carousel') ? (s.style || DEFAULT_STYLE[s.kind]) : null },
  voice: { label: 'Stem', of: s => isVideo(s.kind) ? (s.kind === 'reel-3d' && s.shots?.some(x => x.by) ? 'dialoog' : hasVoice(s) ? s.voice : 'geen') : null },
  style3d: { label: 'Look 3D', of: s => s.kind === 'reel-3d' ? (s.style3d || 'lowpoly') : null },
  voiceStyle: { label: 'Stemstijl', of: s => hasVoice(s) ? (s.voiceStyle || 'rustig') : null },
  music: { label: 'Muziek', of: s => isVideo(s.kind) ? (s.music || 'none') : null },
  captions: { label: 'Ondertitels', of: s => hasVoice(s) && s.kind !== 'reel-quiz' && s.kind !== 'reel-kinetic' && s.kind !== 'reel-verse' ? (s.captions || 'block') : null },
  hook: { label: 'Hook', of: s => s.experiment?.hook || null },
  topic: { label: 'Onderwerp', of: s => s.experiment?.topic || null },
  length: { label: 'Lengte', of: (s, it) => isVideo(s.kind) && it?.media?.duration ? bucket(it.media.duration) : null },
  time: { label: 'Tijdstip', of: s => localTime(s.slot) },
};
export const traitsOf = (spec, item) => Object.fromEntries(Object.entries(TRAITS).map(([k, t]) => [k, t.of(spec, item)]).filter(([, v]) => v != null));

/** The text a voiced item speaks (for the voice budget). */
export function spokenText(s) {
  if (s.kind === 'reel-3d') return (s.shots || []).map(x => x.say || x.line || '').join(' ').trim();
  if (!hasVoice(s)) return '';
  switch (s.kind) {
    case 'reel-explainer': return [s.hook, ...s.lines.map(l => l.say)].join(' ');
    case 'reel-story': return [s.hook, ...s.scenes.map(l => l.say)].join(' ');
    case 'reel-kinetic': return [s.hook, ...s.lines.map(l => l.text)].join(' ');
    case 'reel-list': return [s.hook, ...s.items.map(i => i.say || [i.title, i.text].filter(Boolean).join('. '))].join(' ');
    case 'reel-quiz': return [s.question, `Het antwoord is X: ${s.options[s.answer]}.`, s.explain].join(' ');
    case 'reel-verse': return s.verse?.text || '';
    default: return '';
  }
}

// ---- fair scores
const median = xs => { const a = xs.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const clamp01 = x => Math.max(0, Math.min(1, x));
const engagement = m => ((m.likes || 0) + 2 * (m.comments || 0) + 3 * (m.shares || 0) + 3 * (m.saved || 0)) / Math.max(1, m.views || 0);

/** items (from Mongo, with spec, metrics, publishedAt) -> one trial per item and platform with a score 0..1 */
export function trials(items, { now = Date.now(), minAgeHours = 48 } = {}) {
  const rows = [];
  for (const it of items) {
    if (!it.publishedAt || now - new Date(it.publishedAt).getTime() < minAgeHours * 3600e3) continue;
    for (const [platform, m] of Object.entries(it.metrics || {})) {
      if (!m || !Number.isFinite(m.views)) continue;
      const dur = it.media?.duration;
      const comp = m.avgViewPct != null ? m.avgViewPct / 100 : (m.avgWatchMs != null && dur) ? Math.min(1.5, m.avgWatchMs / 1000 / dur) : null;   // share of the reel watched
      rows.push({ id: it._id, platform, family: isVideo(it.kind) ? 'reel' : 'post', views: m.views, eng: engagement(m), comp, traits: traitsOf(it.spec, it) });
    }
  }
  const groups = new Map();
  for (const r of rows) { const k = `${r.platform}|${r.family}`; groups.set(k, [...(groups.get(k) || []), r]); }
  for (const g of groups.values()) {
    const mv = median(g.map(r => r.views)) ?? 0, me = median(g.map(r => r.eng)) ?? 0, mc = median(g.map(r => r.comp ?? NaN));
    for (const r of g) {
      const v = clamp01(.5 + .25 * Math.log2((r.views + 1) / (mv + 1)));
      const e = clamp01(.5 + .25 * Math.log2((r.eng + .002) / (me + .002)));
      // watch time, where the platform reports it: share watched vs the median share watched
      const c = r.comp != null && mc ? clamp01(.5 + .25 * Math.log2((r.comp + .01) / (mc + .01))) : null;
      const score = c == null ? .6 * v + .4 * e : .45 * v + .3 * e + .25 * c;
      Object.assign(r, { medianViews: mv, score: g.length < 3 ? .5 : score });   // too few to compare yet: neutral
    }
  }
  return rows;
}

// ---- Thompson sampling
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function gamma(r, k) { if (k < 1) return gamma(r, k + 1) * Math.pow(r(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = gauss(r); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r(); if (u < 1 - .0331 * x ** 4 || Math.log(u) < .5 * x * x + d * (1 - v + Math.log(v))) return d * v; } }
const beta = (r, a, b) => { const x = gamma(r, a); return x / (x + gamma(r, b)); };

/** Per trait and value: n, mean score, average views, P(best). values = the catalogue to compare (untested ones included). */
// priors: { trait: { value: [a, b] } } from project.json "experimentPriors" - a head start for what Alex
// expects to work (e.g. [3, 1] = counts as 2 good results before any data). Real results outweigh it soon.
export function scoreboard(rows, catalogue, { seed = 1, draws = 4000, priors = {} } = {}) {
  const r = rng(seed); const out = {};
  for (const [trait, values] of Object.entries(catalogue)) {
    const prior = v => { const p = priors?.[trait]?.[v]; return Array.isArray(p) && p.length === 2 && p.every(x => x > 0) ? p : null; };
    const stats = Object.fromEntries(values.map(v => [v, { n: 0, a: prior(v)?.[0] ?? 1, b: prior(v)?.[1] ?? 1, views: 0 }]));
    const key = trait === 'postFormat' ? 'format' : trait;
    for (const row of rows) { const v = row.traits[key]; if (v == null || !stats[v]) continue; const s = stats[v]; s.n++; s.a += row.score; s.b += 1 - row.score; s.views += row.views; }
    const wins = Object.fromEntries(values.map(v => [v, 0]));
    for (let i = 0; i < draws; i++) { let best = null, bv = -1; for (const v of values) { const x = beta(r, stats[v].a, stats[v].b); if (x > bv) { bv = x; best = v; } } wins[best]++; }
    out[trait] = values.map(v => ({ value: v, n: stats[v].n, mean: +(stats[v].a / (stats[v].a + stats[v].b)).toFixed(3), avgViews: stats[v].n ? Math.round(stats[v].views / stats[v].n) : null, pBest: +(wins[v] / draws).toFixed(3), p: wins[v] / draws, ...(prior(v) ? { prior: prior(v) } : {}) }))
      .sort((x, y) => y.pBest - x.pBest);
  }
  return out;
}

/**
 * Divide `slots` over the values of one trait: explore share evenly, the rest by P(best).
 * Remainders: with `rand` (a () => [0, 1) function) each value gets an extra slot with a chance equal to its
 * remainder (systematic sampling, exactly the slots that are left), so the expected count is its exact share;
 * without it, largest remainder.
 */
export function allocate(rows, slots, explore, { minN = 0, rand = null } = {}) {
  if (!rows?.length || slots <= 0) return {};
  // exploit only what has a track record (minN results) or a prior from Alex, when anything has one
  const P = r => r.p ?? r.pBest;
  const known = rows.filter(r => r.n >= minN || r.prior);
  let base = minN && known.length ? known : rows;
  if (!base.reduce((n, r) => n + P(r), 0)) base = rows;                 // nothing known has a chance: use everything
  const sum = base.reduce((n, r) => n + P(r), 0) || 1;
  const w = rows.map(r => ({ v: r.value, x: slots * (explore / rows.length + (1 - explore) * (base.includes(r) ? P(r) / sum : 0)) }));
  const res = Object.fromEntries(w.map(o => [o.v, Math.floor(o.x)]));
  let left = slots - Object.values(res).reduce((a, b) => a + b, 0);
  if (rand && left > 0) {
    const total = w.reduce((n, o) => n + o.x - Math.floor(o.x), 0), step = total / left;
    let u = rand() * step, acc = 0;
    for (const o of w) { acc += o.x - Math.floor(o.x); while (left > 0 && u < acc) { res[o.v]++; left--; u += step; } }
  }
  // largest remainder: everything without rand, and a slot that rounding error left over with it
  const order = [...w].sort((a, b) => (b.x % 1) - (a.x % 1) || b.x - a.x);
  for (let i = 0; left > 0; i++) { res[order[i % order.length].v]++; left--; }   // largest remainder, as often as needed
  return Object.fromEntries(Object.entries(res).filter(([, n]) => n > 0));
}

/** No value takes more than `cap` slots (variety for the audience); the excess goes to the next best. */
export function capAllocation(alloc, rows, cap) {
  const a = { ...alloc };
  for (;;) {
    const over = Object.keys(a).find(k => a[k] > cap); if (!over) return a;
    const next = rows.find(r => r.value !== over && (a[r.value] || 0) < cap); if (!next) return a;
    a[over]--; a[next.value] = (a[next.value] || 0) + 1;
  }
}

/** Everything that can be tested (the catalogue), given the voices and music that exist. */
export function catalogue({ voices = ['male', 'female'], moods = [], voiceStyles = null, formats = null, postFormats = null, styles = null, styles3d = null, narratorOnly = false } = {}) {
  const only = (list, allowed) => list.filter(v => !allowed || allowed.includes(v));   // project.json limits (formatsAllowed, ...)
  return {
    format: only(REEL_KINDS.filter(k => RENDERABLE.includes(k)), formats), postFormat: only(POST_KINDS.filter(k => RENDERABLE.includes(k)), postFormats),
    style: only(STYLES, styles), style3d: only(STYLES3D, styles3d), voice: narratorOnly ? voices : [...voices, 'dialoog', 'geen'], voiceStyle: VOICE_STYLES.filter(v => !voiceStyles || voiceStyles.includes(v)),
    music: ['none', ...MOODS.filter(m => m !== 'none' && moods.includes(m))], captions: CAPTIONS,
    hook: HOOKS, topic: TOPICS,
  };
}

/** The days that carry a feed post (12:00), as in the recipe of projects/<id>/plan.md. */
export const FEED_DAYS = ['tue', 'thu', 'sat', 'sun'];

/** Format counts per group must match exactly when a group has fewer slots than this (one day); else within 1. */
export const formatTolerance = slots => slots >= 7 ? 1 : 0;

/**
 * The plan for the planner: how many of what (reels per day: 1 main on every platform + extras on TikTok/YouTube).
 * One day: { days: 1, feedPosts: 1 on a feed day else 0, seed }. With `seed` the remainders are drawn at random
 * (see allocate), so a 1-slot group explores across days; without it the result is deterministic.
 */
export function weekAllocation(board, { mainPerDay = 1, extraPerDay = 2, feedPosts = 4, days = 7, seed = null } = {}) {
  const main = mainPerDay * days, extra = extraPerDay * days, reels = main + extra;
  const fmt = board.format; const voiced = reels;
  const rand = seed == null ? null : rng(seed);
  const share = (rows, slots, explore, o = {}) => allocate(rows, slots, explore, { ...o, rand });
  const tol = n => formatTolerance(n) ? 'within 1' : 'exactly';
  return {
    recipe: { mainPerDay, extraPerDay, feedPosts, days },
    mainReels: { slots: main, platforms: 'instagram, facebook, tiktok, youtube', format: fmt.length ? capAllocation(share(fmt, main, .15, { minN: 4 }), [...fmt].sort((a, b) => b.pBest - a.pBest), Math.ceil(main * .55)) : {} },
    extraReels: { slots: extra, platforms: 'tiktok, youtube', format: share(fmt, extra, .5) },
    feedPosts: { slots: feedPosts, platforms: 'instagram, facebook', format: share(board.postFormat, feedPosts, .35) },
    // targets over all reels (soft: within 1 of these is fine; the validator only warns)
    targets: {
      style: share(board.style, reels, .4), style3d: board.style3d ? share(board.style3d, Math.round(reels * .4), .6) : {}, music: share(board.music, reels, .4),
      voice: share(board.voice, voiced, .4), voiceStyle: share(board.voiceStyle, Math.round(reels * .6), .4),
      captions: share(board.captions, Math.round(reels * .35), .4), hook: share(board.hook, reels + feedPosts, .5), topic: share(board.topic, reels + feedPosts, .5),
    },
    rule: `Formats per group are hard (main reels ${tol(main)}, extra reels ${tol(extra)}, feed posts ${tol(feedPosts)}), the number of feed posts too. Targets are soft (within 1; voiceStyle, captions and style3d are estimates for the reels that have them). Voice "geen" only for formats where a voice is optional (not reel-explainer or reel-story).`,
  };
}
export { hasVoice, VOICE_REQUIRED };
