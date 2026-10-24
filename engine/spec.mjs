// The contract between the brain (Claude) and the engine. Claude writes specs; the engine
// validates, renders and publishes them. Anything not in a spec is decided by templates.
import { z } from 'zod';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { project, SHARED_ASSETS } from './project.mjs';

// What exists for the current project: its screenshots, and photos (its own, else the shared set).
const P = project();
const list = (dir, ext) => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(ext)).sort() : [];
export const SCREENSHOTS = list(P.paths.screenshots, '.png').map(f => f.replace(/\.png$/, ''));
export const PHOTO_DIR = list(P.paths.photos, '.jpg').length ? P.paths.photos : join(SHARED_ASSETS, 'photos');
export const PHOTO_COUNT = list(PHOTO_DIR, '.jpg').length;
// Places a map scene can show (Dutch names, real coordinates): engine/render/data/places.json
const PLACES_FILE = join(dirname(fileURLToPath(import.meta.url)), 'render', 'data', 'places.json');
export const PLACES = existsSync(PLACES_FILE) ? Object.keys(JSON.parse(readFileSync(PLACES_FILE, 'utf8')).places) : [];

// What a 3D reel can use (looks, sets + spots, cameras, actions): engine/render/3d/catalog.json
const CATALOG_FILE = join(dirname(fileURLToPath(import.meta.url)), 'render', '3d', 'catalog.json');
export const CATALOG3D = existsSync(CATALOG_FILE) ? JSON.parse(readFileSync(CATALOG_FILE, 'utf8')) : { looks: {}, sets: {}, cameras: {}, actions: {}, bases: [], moods: [] };

const ref = z.string().regex(/^.+\s\d+:\d+(-\d+)?$/, 'Bible reference like "Johannes 3:16"');
// An app screenshot (assets/screenshots, see screens.json for what each shows) or a live web screen of
// the right chapter: web:bijbel/<boek>/<hoofdstuk> | web:bijbelboeken/<boek> (engine/render/webscreens.mjs)
const { webKeyProblem } = await import('./render/webscreens.mjs');
const screenshot = z.string().refine(s => s.startsWith('web:') ? !webKeyProblem(s) : SCREENSHOTS.includes(s), s => ({ message: s.startsWith('web:') ? webKeyProblem(s)
  : SCREENSHOTS.length ? `Unknown screenshot "${s}". Use one of: ${SCREENSHOTS.join(', ')}, or web:bijbel/<boek>/<hoofdstuk>` : `${P.name} has no screenshots yet (projects/${P.id}/assets/screenshots/)` }));
const photo = z.number().int().min(1).max(Math.max(1, PHOTO_COUNT)).refine(() => PHOTO_COUNT > 0, `${P.name} has no photos yet (projects/${P.id}/assets/photos/)`);
const place = z.string().refine(s => PLACES.includes(s), s => ({ message: `Unknown place "${s}". Use one of: ${PLACES.join(', ')}` }));
const shortLine = z.string().min(2).max(90);
const noLongDash = s => !/[–—]/.test(s);
const said = (min, max) => z.string().min(min).max(max).refine(noLongDash, 'Use a plain hyphen, never a long dash');
const PLATFORMS = P.platforms;

// ---- experiment traits: every item says what it tests (see engine/experiments.mjs and P/plan.md)
export const HOOKS = ['pijnpunt', 'waardebelofte', 'inzicht', 'verrassing', 'waar-begin-je', 'grondtekst', 'opluchting', 'vraag', 'herkenning'];
export const TOPICS = ['boek', 'persoon', 'context', 'woord', 'thema', 'vers', 'app', 'praktisch'];
export const STYLES = ['light', 'dark', 'photo'];
export const MOODS = ['none', 'calm', 'hopeful', 'reflective', 'cinematic', 'warm', 'upbeat'];
export const CAPTIONS = ['karaoke', 'block', 'none'];
export const VOICE_STYLES = ['rustig', 'levendig'];
export const STYLES3D = ['lowpoly', 'rond', 'toon', 'blok', 'klei', 'silhouet', 'papier'];   // looks of a 3D reel (engine/render/3d/core.js)

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  slot: z.string().datetime({ offset: true }),           // when it should go live
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  caption: z.string().min(10).max(2000).refine(noLongDash, 'Use a plain hyphen, never a long dash'),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(8).default([]),
  experiment: z.object({
    feedType: z.enum(['video-first', 'spotlight', 'statement', 'carousel']).optional(),
    voice: z.enum(['male', 'female']).optional(),        // legacy (weeks before the voice library)
    hook: z.enum(HOOKS).optional(),
    topic: z.enum(TOPICS).optional(),
    note: z.string().max(200).optional(),
  }).default({}),
  basedOn: z.string().max(300),                          // the real fact, pain point or feature it rests on
  // what the item is about in a few words ("Ruth", "Paulus in Athene", "Leesplannen"). Not repeated within
  // 12 weeks (engine/repeats.mjs); required for new items except verse-still / reel-verse
  subject: z.string().min(2).max(60).optional(),
};

// Left out = the project's default from project.json (endCard.headline / sub / first button).
const endCard = z.object({
  headline: shortLine.optional(),
  sub: z.string().max(80).optional(),
  button: z.enum(P.endCard.buttons).optional(),
}).default({});

// Shared by every reel. voice: "male"/"female" (the two voices chosen in the studio) or a key from the
// voice test set (content/context/voices.json); left out = no voice (where the format allows that).
const voice = z.string().regex(/^[a-z0-9-]+$/);
const reel = {
  style: z.enum(STYLES).optional(),                      // look; left out = the format's default
  music: z.enum(MOODS).optional(),                       // background music mood; left out = none
  voiceStyle: z.enum(VOICE_STYLES).optional(),           // rustig = steady narrator, levendig = expressive model
  captions: z.enum(CAPTIONS).optional(),                 // burned-in subtitles for voiced reels; left out = block
  endCard,
};

export const VerseStill = z.object({ ...base, kind: z.literal('verse-still'), ref, photo });

export const ReelVerse = z.object({ ...base, ...reel, kind: z.literal('reel-verse'), ref, photo, voice: voice.optional() });

export const ReelDemo = z.object({
  ...base, ...reel, kind: z.literal('reel-demo'),
  hook: shortLine,                                       // first 1.5 s, the scroll-stopper
  scenes: z.array(z.object({ screenshot, caption: shortLine })).min(2).max(5),
});

export const ReelExplainer = z.object({
  ...base, ...reel, kind: z.literal('reel-explainer'),
  voice,
  hook: shortLine,
  // each line is spoken and shown as a caption; a line shows a verse (exact text from data/) or a screen
  lines: z.array(z.object({ say: said(4, 220), verse: ref.optional(), screenshot: screenshot.optional() })).min(3).max(9),
});

// Big animated words, line by line (kinetic typography). With a voice the words land on the spoken beat.
export const ReelKinetic = z.object({
  ...base, ...reel, kind: z.literal('reel-kinetic'),
  voice: voice.optional(),
  hook: shortLine,
  lines: z.array(z.object({
    text: said(3, 140),
    emphasis: z.string().max(40).optional(),             // word(s) from text to colour, e.g. "blijdschap"
    verse: ref.optional(),                               // shows the exact verse under the line
  })).min(2).max(8),
});

// Question, options, countdown, answer + short explanation. Viewers answer in the comments.
export const ReelQuiz = z.object({
  ...base, ...reel, kind: z.literal('reel-quiz'),
  voice: voice.optional(),
  question: said(8, 120),
  options: z.array(z.string().min(1).max(60)).min(2).max(4),
  answer: z.number().int().min(0).max(3),
  explain: said(10, 200),
  verseRef: ref.optional(),                              // shown under the explanation (exact text from data/)
}).refine(s => s.answer < s.options.length, { message: 'answer must point to one of the options (0-based)', path: ['answer'] });

// "5 dingen die je niet wist over ..." - a numbered list, one item per beat.
export const ReelList = z.object({
  ...base, ...reel, kind: z.literal('reel-list'),
  voice: voice.optional(),
  hook: shortLine,                                       // the title, e.g. "5 dingen die je niet wist over Ruth"
  items: z.array(z.object({
    title: said(2, 70),
    say: said(4, 220).optional(),                        // spoken text for this item (voice); else the title is read
    text: z.string().max(160).optional(),                // small line under the title
    verse: ref.optional(), screenshot: screenshot.optional(),
  })).min(3).max(7),
});

// Narrated story with animated scenes: a map with a route, a timeline, a big line, a verse, a photo,
// a counting number (stat), a family line (tree), two sides (compare) or a Hebrew/Greek word (word).
export const ReelStory = z.object({
  ...base, ...reel, kind: z.literal('reel-story'),
  voice,
  hook: shortLine,
  scenes: z.array(z.object({
    say: said(4, 220),
    show: z.enum(['map', 'timeline', 'text', 'verse', 'photo', 'stat', 'tree', 'compare', 'word']),
    places: z.array(place).min(1).max(7).optional(),     // map: in route order; one place = a pin
    events: z.array(z.object({ year: z.string().max(14), label: z.string().max(40) })).min(2).max(6).optional(), // timeline
    focus: z.number().int().min(0).max(5).optional(),    // timeline: which event to highlight
    text: z.string().max(110).optional(),                // text: the line on screen (else the spoken line); stat: small line; compare: heading
    verse: ref.optional(),                               // verse: exact text from data/; word: shown small under the word
    photo: photo.optional(),                             // photo: background number
    // stat: counts up to value, keeping any prefix/suffix ("66", "1500+", "3x"); label under the number
    stat: z.object({ value: said(1, 12).refine(v => /\d/.test(v), 'stat.value needs a number, like "66" or "1500+"'), label: said(2, 60) }).optional(),
    tree: z.array(z.object({ name: said(1, 24), note: said(1, 40).optional() })).min(2).max(6).optional(), // tree: a lineage, top to bottom
    compare: z.object({                                  // compare: two cards side by side, points appear one by one
      left: z.object({ title: said(1, 24), points: z.array(said(2, 40)).min(1).max(3) }),
      right: z.object({ title: said(1, 24), points: z.array(said(2, 40)).min(1).max(3) }),
    }).optional(),
    // word: an original-language word in its own script (Hebrew right to left), transliteration and meaning
    word: z.object({ original: z.string().min(1).max(24), lang: z.enum(['hebreeuws', 'grieks']), translit: said(1, 30), meaning: said(2, 80) }).optional(),
  }).superRefine((s, c) => {
    if (s.show === 'map' && !s.places) c.addIssue({ code: 'custom', message: 'a map scene needs places', path: ['places'] });
    if (s.show === 'timeline' && !s.events) c.addIssue({ code: 'custom', message: 'a timeline scene needs events', path: ['events'] });
    if (s.show === 'verse' && !s.verse) c.addIssue({ code: 'custom', message: 'a verse scene needs verse', path: ['verse'] });
    if (s.show === 'photo' && !s.photo) c.addIssue({ code: 'custom', message: 'a photo scene needs photo', path: ['photo'] });
    for (const k of ['stat', 'tree', 'compare', 'word']) if (s.show === k && !s[k]) c.addIssue({ code: 'custom', message: `a ${k} scene needs ${k}`, path: [k] });
    if (s.word && !(s.word.lang === 'hebreeuws' ? /^[\p{Script=Hebrew}\s]+$/u : /^[\p{Script=Greek}\p{M}\s]+$/u).test(s.word.original))
      c.addIssue({ code: 'custom', message: `word.original must be the ${s.word.lang === 'hebreeuws' ? 'Hebrew' : 'Greek'} word in its own script only`, path: ['word', 'original'] });
  })).min(3).max(8),
});

// 3D animated reel: characters acting in 3D sets, shot by shot (engine/render/templates/scene3d.js).
// Every shot is one spoken line - the narrator ("say", voice = spec.voice) or a character ("by" + "line",
// voice = that cast member's voice) - or a silent "hold" of 1-4 s. Dialog: every speaker a different voice.
const keys = o => Object.keys(o || {});
const enumOf = (list, what) => z.string().refine(v => list.includes(v), v => ({ message: `Unknown ${what} "${v}". Use one of: ${list.join(', ')}` }));
const actor3d = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  at: z.string(),                                         // a spot of the shot's set (catalog.json)
  to: z.string().optional(),                              // walks there during the shot
  do: enumOf(keys(CATALOG3D.actions), 'action').optional(),
  base: enumOf(CATALOG3D.bases, 'base').optional(),       // stand / sit / kneel / lie (default: the spot's)
  face: z.string().optional(),                            // an actor id, a spot, or "camera"
  mood: enumOf(CATALOG3D.moods, 'mood').optional(),
  holds: enumOf(keys(CATALOG3D.holds || {}), 'thing to carry').optional(),   // with do "carry": what is in the hands
});
const shot3d = z.object({
  set: enumOf(keys(CATALOG3D.sets), 'set'),
  time: z.enum(['dag', 'avond', 'nacht']).optional(),
  weather: z.enum(['helder', 'storm']).optional(),
  camera: enumOf(keys(CATALOG3D.cameras), 'camera').optional(),
  on: z.string().optional(),                              // actor the camera frames (default: the speaker)
  actors: z.array(actor3d).max(4).default([]),
  say: said(4, 220).optional(),                           // narrator
  by: z.string().optional(), line: said(2, 200).optional(),   // a character speaks
  hold: z.number().min(1).max(4).optional(),              // silent shot
  text: z.string().max(60).optional(),                    // small label: place / time ("Joppe, ca. 760 v.Chr.")
  verse: ref.optional(),                                  // verse card (exact SV text)
  app: screenshot.optional(),                             // the app on a phone, full size over the scene
  screen: screenshot.optional(),                          // what the phone in someone's hand shows
  places: z.array(place).min(2).max(7).optional(),        // set "kaart": the route in travel order
}).superRefine((s, c) => {
  const n = [s.say, s.line, s.hold].filter(x => x != null).length;
  if (n !== 1) c.addIssue({ code: 'custom', message: 'a shot has exactly one of: say (narrator), line + by (a character), hold (silent seconds)' });
  if (s.line && !s.by) c.addIssue({ code: 'custom', message: 'line needs by (the actor id who speaks)', path: ['by'] });
  if (s.by && !s.line) c.addIssue({ code: 'custom', message: 'by goes with line', path: ['line'] });
  const set = CATALOG3D.sets[s.set]; if (!set) return;
  if (s.time && set.time && !set.time.includes(s.time)) c.addIssue({ code: 'custom', message: `set ${s.set} has time ${set.time.join('/')}`, path: ['time'] });
  if (s.weather && !set.weather?.includes(s.weather)) c.addIssue({ code: 'custom', message: `set ${s.set} has no weather (only zee: helder/storm)`, path: ['weather'] });
  if (s.set === 'kaart' && !s.places) c.addIssue({ code: 'custom', message: 'set kaart needs places (2-7, in travel order)', path: ['places'] });
  s.actors.forEach((a, i) => {
    for (const k of ['at', 'to']) if (a[k] && !keys(set.spots).includes(a[k])) c.addIssue({ code: 'custom', message: `spot "${a[k]}" is not in set ${s.set}. Spots: ${keys(set.spots).join(', ') || '(none - no actors in this set)'}`, path: ['actors', i, k] });
  });
  if (s.by && !s.actors.some(a => a.id === s.by)) c.addIssue({ code: 'custom', message: `the speaker "${s.by}" must be one of this shot's actors`, path: ['by'] });
  if (s.on && !s.actors.some(a => a.id === s.on)) c.addIssue({ code: 'custom', message: `on "${s.on}" must be one of this shot's actors`, path: ['on'] });
  if (s.camera === 'phone' && !s.actors.some(a => (a.do === 'phone' || a.do === 'show-phone') && (!s.on || a.id === s.on))) c.addIssue({ code: 'custom', message: 'camera phone needs an actor doing phone or show-phone', path: ['camera'] });
});
export const ReelScene = z.object({
  ...base, ...reel, kind: z.literal('reel-3d'),
  voice: voice.optional(),                                // narrator (needed when a shot has "say")
  hook: shortLine,                                        // big title over the first shot
  style3d: z.enum(STYLES3D).optional(),   // look: lowpoly (default) | rond | toon | blok | klei | silhouet (shadow play at dusk) | papier (storybook paper)
  cast: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), look: enumOf(keys(CATALOG3D.looks), 'look'), name: z.string().max(30).optional(), voice: voice.optional() })).max(4).default([]),
  shots: z.array(shot3d).min(3).max(14),
}).superRefine((s, c) => {
  const ids = s.cast.map(x => x.id);
  if (new Set(ids).size !== ids.length) c.addIssue({ code: 'custom', message: 'cast ids must be unique', path: ['cast'] });
  s.shots.forEach((sh, i) => sh.actors.forEach((a, j) => { if (!ids.includes(a.id)) c.addIssue({ code: 'custom', message: `actor "${a.id}" is not in cast`, path: ['shots', i, 'actors', j, 'id'] }); }));
  if (s.shots.some(sh => sh.say) && (!s.voice || s.voice === 'none')) c.addIssue({ code: 'custom', message: 'shots with "say" need a narrator voice (voice)', path: ['voice'] });
  const speakers = [...new Set(s.shots.map(sh => sh.by).filter(Boolean))];
  for (const id of speakers) { const m = s.cast.find(x => x.id === id); if (m && !m.voice) c.addIssue({ code: 'custom', message: `cast member "${id}" speaks, so give them a voice`, path: ['cast'] }); }
  const vs = [...speakers.map(id => s.cast.find(x => x.id === id)?.voice).filter(Boolean), ...(s.shots.some(sh => sh.say) && s.voice ? [s.voice] : [])];
  if (new Set(vs).size !== vs.length) c.addIssue({ code: 'custom', message: 'every speaker (and the narrator) needs a different voice - one voice per person, never two people with one voice', path: ['cast'] });
  if (Math.abs(s.shots.reduce((n, sh) => n + (sh.say || sh.line || '').length, 0)) > 1100) c.addIssue({ code: 'custom', message: 'too much text for one reel - keep all lines together under 1100 characters (about 60 s)', path: ['shots'] });
});

export const PostSpotlight = z.object({
  ...base, kind: z.literal('post-spotlight'),
  screenshot, headline: shortLine, sub: z.string().max(120),
});

export const PostStatement = z.object({
  ...base, kind: z.literal('post-statement'),
  line: z.string().min(8).max(110), sub: z.string().max(90).optional(),
});

// Instagram/Facebook carousel, 1080x1350 slides. A CTA slide (end card) is added at the end.
const slide = z.discriminatedUnion('type', [
  z.object({ type: z.literal('cover'), title: z.string().min(2).max(90), sub: z.string().max(110).optional(), photo: photo.optional() }),
  z.object({ type: z.literal('text'), title: z.string().max(70).optional(), text: z.string().min(4).max(300) }),
  z.object({ type: z.literal('point'), title: z.string().min(2).max(70), text: z.string().max(220).optional() }),
  z.object({ type: z.literal('verse'), verse: ref, note: z.string().max(160).optional() }),
  z.object({ type: z.literal('screen'), screenshot, title: z.string().min(2).max(70), text: z.string().max(140).optional() }),
]);
export const Carousel = z.object({
  ...base, kind: z.literal('carousel'),
  style: z.enum(STYLES).optional(),
  slides: z.array(slide).min(3).max(9),
  endCard,
}).refine(s => s.slides[0].type === 'cover', { message: 'the first slide must be type "cover" (the hook)', path: ['slides', 0] })
  .refine(s => s.platforms.every(p => p === 'instagram' || p === 'facebook'), { message: 'carousels go to instagram and facebook only', path: ['platforms'] });

export const Spec = z.union([VerseStill, ReelVerse, ReelDemo, ReelExplainer, ReelKinetic, ReelQuiz, ReelList, ReelStory, ReelScene, PostSpotlight, PostStatement, Carousel]);
const SCHEMAS = { 'verse-still': VerseStill, 'reel-verse': ReelVerse, 'reel-demo': ReelDemo, 'reel-explainer': ReelExplainer, 'reel-kinetic': ReelKinetic,
  'reel-quiz': ReelQuiz, 'reel-list': ReelList, 'reel-story': ReelStory, 'reel-3d': ReelScene, 'post-spotlight': PostSpotlight, 'post-statement': PostStatement, carousel: Carousel };
export const KINDS = Object.keys(SCHEMAS);
export const REEL_KINDS = KINDS.filter(k => k.startsWith('reel-'));
export const isVideo = kind => kind.startsWith('reel-');
export const VOICE_REQUIRED = ['reel-explainer', 'reel-story'];
/** Kinds that have a template (engine/render/templates/*.js register T['kind']). */
const TEMPLATES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'render', 'templates');
export const RENDERABLE = existsSync(TEMPLATES_DIR) ? [...new Set(readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.js'))
  .flatMap(f => [...readFileSync(join(TEMPLATES_DIR, f), 'utf8').matchAll(/T\['([a-z0-9-]+)'\]\s*=[^=]/g)].map(m => m[1])))] : KINDS;

/** Validate + enrich: fills exact verse text so templates and reviewers see the real words. */
export async function prepare(raw) {
  const schema = SCHEMAS[raw?.kind];
  if (!schema) throw new Error(`Unknown kind "${raw?.kind}". Use one of: ${KINDS.join(', ')}`);
  if (!RENDERABLE.includes(raw.kind)) throw new Error(`"${raw.kind}" has no template yet - use one of: ${RENDERABLE.join(', ')}`);
  const spec = schema.parse(raw);
  if (VOICE_REQUIRED.includes(spec.kind) && (!spec.voice || spec.voice === 'none')) throw new Error(`${spec.kind} always speaks: set voice to male, female or a key from voices.json`);
  const { getVerse } = await import('./verses.mjs');
  if (spec.ref) spec.verse = getVerse(spec.ref);
  if (spec.kind === 'reel-quiz' && spec.verseRef) spec.verseData = getVerse(spec.verseRef);
  for (const l of spec.lines || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.items || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.scenes || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.slides || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.shots || []) if (l.verse) l.verseData = getVerse(l.verse);
  return spec;
}
