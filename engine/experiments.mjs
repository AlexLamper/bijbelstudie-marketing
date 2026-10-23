// What we test and how next week's slots are divided.
//
// 1. Traits: every item has traits (format, look, voice, voice style, music, subtitles, hook, topic,
//    length, time). Most are read from the spec itself, so the planner cannot mislabel them.
// 2. Fair score per item and platform, once it has been online for 48 hours: its views compared with
//    the median of the same platform and media type (reel or post) over the last 8 weeks, and its
//    engagement (likes, comments, shares, saves per view) compared the same way. 2x the median views
//    = 0.75, 4x = 1, half = 0.25. score = 0.6 * views part + 0.4 * engagement part, from 0 to 1;
//    where the platform reports watch time: 0.45 views + 0.3 engagement + 0.25 share watched.
// 3. Per trait value a Beta(1 + sum of scores, 1 + sum of (1 - score)) belief; Thompson sampling gives
//    the chance that each value is the best. Next week's slots: a fixed share for exploring (spread
//    evenly, so new things keep getting tried) + the rest in proportion to that chance.
import { HOOKS, TOPICS, STYLES, MOODS, CAPTIONS, VOICE_STYLES, REEL_KINDS, VOICE_REQUIRED, RENDERABLE, isVideo } from './spec.mjs';

export const POST_KINDS = ['post-spotlight', 'post-statement', 'carousel'];
export const DEFAULT_STYLE = { 'reel-explainer': 'light', 'reel-demo': 'light', 'reel-verse': 'photo', 'reel-kinetic': 'dark', 'reel-quiz': 'light', 'reel-list': 'light', 'reel-story': 'dark', carousel: 'light' };
const hasVoice = s => !!s.voice && s.voice !== 'none';
const bucket = d => d < 15 ? '<15s' : d < 30 ? '15-30s' : d < 45 ? '30-45s' : '45s+';
const localTime = (iso, tz = 'Europe/Amsterdam') => new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso));

/** Trait name -> { label, of(spec, item) }. A null value = the trait does not apply to this item. */
export const TRAITS = {
  format: { label: 'Formaat', of: s => s.kind },
  style: { label: 'Look', of: s => (isVideo(s.kind) || s.kind === 'carousel') ? (s.style || DEFAULT_STYLE[s.kind]) : null },
  voice: { label: 'Stem', of: s => isVideo(s.kind) ? (hasVoice(s) ? s.voice : 'geen') : null },
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
export function scoreboard(rows, catalogue, { seed = 1, draws = 4000 } = {}) {
  const r = rng(seed); const out = {};
  for (const [trait, values] of Object.entries(catalogue)) {
    const stats = Object.fromEntries(values.map(v => [v, { n: 0, a: 1, b: 1, views: 0 }]));
    const key = trait === 'postFormat' ? 'format' : trait;
    for (const row of rows) { const v = row.traits[key]; if (v == null || !stats[v]) continue; const s = stats[v]; s.n++; s.a += row.score; s.b += 1 - row.score; s.views += row.views; }
    const wins = Object.fromEntries(values.map(v => [v, 0]));
    for (let i = 0; i < draws; i++) { let best = null, bv = -1; for (const v of values) { const x = beta(r, stats[v].a, stats[v].b); if (x > bv) { bv = x; best = v; } } wins[best]++; }
    out[trait] = values.map(v => ({ value: v, n: stats[v].n, mean: +(stats[v].a / (stats[v].a + stats[v].b)).toFixed(3), avgViews: stats[v].n ? Math.round(stats[v].views / stats[v].n) : null, pBest: +(wins[v] / draws).toFixed(3), p: wins[v] / draws }))
      .sort((x, y) => y.pBest - x.pBest);
  }
  return out;
}

/** Divide `slots` over the values of one trait: explore share evenly, the rest by P(best). Largest remainder. */
export function allocate(rows, slots, explore, { minN = 0 } = {}) {
  if (!rows?.length || slots <= 0) return {};
  // exploit only what has a track record (minN results), when anything has one
  const P = r => r.p ?? r.pBest;
  const known = rows.filter(r => r.n >= minN);
  let base = minN && known.length ? known : rows;
  if (!base.reduce((n, r) => n + P(r), 0)) base = rows;                 // nothing known has a chance: use everything
  const sum = base.reduce((n, r) => n + P(r), 0) || 1;
  const w = rows.map(r => ({ v: r.value, x: slots * (explore / rows.length + (1 - explore) * (base.includes(r) ? P(r) / sum : 0)) }));
  const res = Object.fromEntries(w.map(o => [o.v, Math.floor(o.x)]));
  let left = slots - Object.values(res).reduce((a, b) => a + b, 0);
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
export function catalogue({ voices = ['male', 'female'], moods = [] } = {}) {
  return {
    format: REEL_KINDS.filter(k => RENDERABLE.includes(k)), postFormat: POST_KINDS.filter(k => RENDERABLE.includes(k)),
    style: STYLES, voice: [...voices, 'geen'], voiceStyle: VOICE_STYLES,
    music: ['none', ...MOODS.filter(m => m !== 'none' && moods.includes(m))], captions: CAPTIONS,
    hook: HOOKS, topic: TOPICS,
  };
}

/** The week's plan for the planner: how many of what (reels per day: 1 main on every platform + extras on TikTok/YouTube). */
export function weekAllocation(board, { mainPerDay = 1, extraPerDay = 2, feedPosts = 4, days = 7 } = {}) {
  const main = mainPerDay * days, extra = extraPerDay * days, reels = main + extra;
  const fmt = board.format; const voiced = reels;
  return {
    recipe: { mainPerDay, extraPerDay, feedPosts, days },
    mainReels: { slots: main, platforms: 'instagram, facebook, tiktok, youtube', format: capAllocation(allocate(fmt, main, .15, { minN: 4 }), [...fmt].sort((a, b) => (b.n >= 4) - (a.n >= 4) || b.pBest - a.pBest), Math.ceil(main * .55)) },
    extraReels: { slots: extra, platforms: 'tiktok, youtube', format: allocate(fmt, extra, .5) },
    feedPosts: { slots: feedPosts, platforms: 'instagram, facebook', format: allocate(board.postFormat, feedPosts, .35) },
    // targets over all reels (soft: within 1 of these is fine; the validator only warns)
    targets: {
      style: allocate(board.style, reels, .4), music: allocate(board.music, reels, .4),
      voice: allocate(board.voice, voiced, .4), voiceStyle: allocate(board.voiceStyle, Math.round(reels * .6), .4),
      captions: allocate(board.captions, Math.round(reels * .35), .4), hook: allocate(board.hook, reels + feedPosts, .5), topic: allocate(board.topic, reels + feedPosts, .5),
    },
    rule: 'Formats per group are hard (within 1), the number of feed posts too. Targets are soft (voiceStyle and captions are estimates for the voiced reels that have them). Voice "geen" only for formats where a voice is optional (not reel-explainer or reel-story).',
  };
}
export { hasVoice, VOICE_REQUIRED };
