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

const ref = z.string().regex(/^.+\s\d+:\d+(-\d+)?$/, 'Bible reference like "Johannes 3:16"');
const screenshot = z.string().refine(s => SCREENSHOTS.includes(s), s => ({ message: SCREENSHOTS.length
  ? `Unknown screenshot "${s}". Use one of: ${SCREENSHOTS.join(', ')}` : `${P.name} has no screenshots yet (projects/${P.id}/assets/screenshots/)` }));
const photo = z.number().int().min(1).max(Math.max(1, PHOTO_COUNT)).refine(() => PHOTO_COUNT > 0, `${P.name} has no photos yet (projects/${P.id}/assets/photos/)`);
const place = z.string().refine(s => PLACES.includes(s), s => ({ message: `Unknown place "${s}". Use one of: ${PLACES.join(', ')}` }));
const shortLine = z.string().min(2).max(90);
const noLongDash = s => !/[–—]/.test(s);
const said = (min, max) => z.string().min(min).max(max).refine(noLongDash, 'Use a plain hyphen, never a long dash');
const PLATFORMS = P.platforms;

// ---- experiment traits: every item says what it tests (see engine/experiments.mjs and P/plan.md)
export const HOOKS = ['pijnpunt', 'waardebelofte', 'inzicht', 'verrassing', 'waar-begin-je', 'grondtekst', 'opluchting', 'vraag', 'herkenning'];
export const TOPICS = ['boek', 'persoon', 'context', 'woord', 'thema', 'vers', 'app', 'praktisch', 'quiz'];
export const STYLES = ['light', 'dark', 'photo'];
export const MOODS = ['none', 'calm', 'hopeful', 'reflective', 'cinematic', 'warm', 'upbeat'];
export const CAPTIONS = ['karaoke', 'block', 'none'];
export const VOICE_STYLES = ['rustig', 'levendig'];

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
  verse: ref.optional(),
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

// Narrated story with animated scenes: a map with a route, a timeline, a big line, a verse or a photo.
export const ReelStory = z.object({
  ...base, ...reel, kind: z.literal('reel-story'),
  voice,
  hook: shortLine,
  scenes: z.array(z.object({
    say: said(4, 220),
    show: z.enum(['map', 'timeline', 'text', 'verse', 'photo']),
    places: z.array(place).min(1).max(7).optional(),     // map: in route order; one place = a pin
    events: z.array(z.object({ year: z.string().max(14), label: z.string().max(40) })).min(2).max(6).optional(), // timeline
    focus: z.number().int().min(0).max(5).optional(),    // timeline: which event to highlight
    text: z.string().max(110).optional(),                // text: the line on screen (else the spoken line)
    verse: ref.optional(),                               // verse: exact text from data/
    photo: photo.optional(),                             // photo: background number
  }).superRefine((s, c) => {
    if (s.show === 'map' && !s.places) c.addIssue({ code: 'custom', message: 'a map scene needs places', path: ['places'] });
    if (s.show === 'timeline' && !s.events) c.addIssue({ code: 'custom', message: 'a timeline scene needs events', path: ['events'] });
    if (s.show === 'verse' && !s.verse) c.addIssue({ code: 'custom', message: 'a verse scene needs verse', path: ['verse'] });
    if (s.show === 'photo' && !s.photo) c.addIssue({ code: 'custom', message: 'a photo scene needs photo', path: ['photo'] });
  })).min(3).max(8),
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

export const Spec = z.union([VerseStill, ReelVerse, ReelDemo, ReelExplainer, ReelKinetic, ReelQuiz, ReelList, ReelStory, PostSpotlight, PostStatement, Carousel]);
const SCHEMAS = { 'verse-still': VerseStill, 'reel-verse': ReelVerse, 'reel-demo': ReelDemo, 'reel-explainer': ReelExplainer, 'reel-kinetic': ReelKinetic,
  'reel-quiz': ReelQuiz, 'reel-list': ReelList, 'reel-story': ReelStory, 'post-spotlight': PostSpotlight, 'post-statement': PostStatement, carousel: Carousel };
export const KINDS = Object.keys(SCHEMAS);
export const REEL_KINDS = KINDS.filter(k => k.startsWith('reel-'));
export const isVideo = kind => kind.startsWith('reel-');
export const VOICE_REQUIRED = ['reel-explainer', 'reel-story'];

/** Validate + enrich: fills exact verse text so templates and reviewers see the real words. */
export async function prepare(raw) {
  const schema = SCHEMAS[raw?.kind];
  if (!schema) throw new Error(`Unknown kind "${raw?.kind}". Use one of: ${KINDS.join(', ')}`);
  const spec = schema.parse(raw);
  const { getVerse } = await import('./verses.mjs');
  if (spec.ref) spec.verse = getVerse(spec.ref);
  if (spec.kind === 'reel-quiz' && spec.verse) spec.verseData = getVerse(spec.verse);
  for (const l of spec.lines || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.items || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.scenes || []) if (l.verse) l.verseData = getVerse(l.verse);
  for (const l of spec.slides || []) if (l.verse) l.verseData = getVerse(l.verse);
  return spec;
}
