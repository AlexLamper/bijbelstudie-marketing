// The contract between the brain (Claude) and the engine. Claude writes specs; the engine
// validates, renders and publishes them. Anything not in a spec is decided by templates.
import { z } from 'zod';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

export const SCREENSHOTS = readdirSync(join(ROOT, 'assets', 'screenshots')).map(f => f.replace(/\.png$/, ''));
export const PHOTO_COUNT = readdirSync(join(ROOT, 'assets', 'photos')).length;

const ref = z.string().regex(/^.+\s\d+:\d+(-\d+)?$/, 'Bible reference like "Johannes 3:16"');
const screenshot = z.string().refine(s => SCREENSHOTS.includes(s), s => ({ message: `Unknown screenshot "${s}". Use one of: ${SCREENSHOTS.join(', ')}` }));
const photo = z.number().int().min(1).max(365);
const shortLine = z.string().min(2).max(90);
const noLongDash = s => !/[\u2013\u2014]/.test(s);
const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'];

const base = {
  id: z.string().regex(/^[a-z0-9-]+$/),
  week: z.string().regex(/^\d{4}-W\d{2}$/),
  slot: z.string().datetime({ offset: true }),           // when it should go live
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  caption: z.string().min(10).max(2000).refine(noLongDash, 'Use a plain hyphen, never a long dash'),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u)).max(8).default([]),
  experiment: z.object({
    feedType: z.enum(['video-first', 'spotlight', 'statement']).optional(),
    voice: z.enum(['male', 'female']).optional(),
    hook: z.enum(['pijnpunt', 'waardebelofte', 'inzicht', 'verrassing', 'waar-begin-je', 'grondtekst', 'opluchting', 'vraag', 'herkenning']).optional(),
    note: z.string().max(200).optional(),
  }).default({}),
  basedOn: z.string().max(300),                          // the real fact, pain point or feature it rests on
};

const endCard = z.object({
  headline: shortLine.default('Begrijp wat je leest.'),
  sub: z.string().max(80).default('Uitleg, context en grondtekst naast elk hoofdstuk.'),
  button: z.enum(['Download gratis', 'Begin gratis']).default('Download gratis'),
}).default({});

export const VerseStill = z.object({ ...base, kind: z.literal('verse-still'), ref, photo });

export const ReelVerse = z.object({ ...base, kind: z.literal('reel-verse'), ref, photo, endCard });

export const ReelDemo = z.object({
  ...base, kind: z.literal('reel-demo'),
  hook: shortLine,                                       // first 1.5 s, the scroll-stopper
  scenes: z.array(z.object({ screenshot, caption: shortLine })).min(2).max(5),
  endCard,
});

export const ReelExplainer = z.object({
  ...base, kind: z.literal('reel-explainer'),
  voice: z.enum(['male', 'female']),
  hook: shortLine,
  // each line is spoken and shown as a caption; a line shows a verse (exact SV text) or a screen
  lines: z.array(z.object({
    say: z.string().min(4).max(220).refine(noLongDash),
    verse: ref.optional(),
    screenshot: screenshot.optional(),
  })).min(3).max(9),
  endCard,
});

export const PostSpotlight = z.object({
  ...base, kind: z.literal('post-spotlight'),
  screenshot, headline: shortLine, sub: z.string().max(120),
});

export const PostStatement = z.object({
  ...base, kind: z.literal('post-statement'),
  line: z.string().min(8).max(110), sub: z.string().max(90).optional(),
});

export const Spec = z.discriminatedUnion('kind', [VerseStill, ReelVerse, ReelDemo, ReelExplainer, PostSpotlight, PostStatement]);
export const KINDS = ['verse-still', 'reel-verse', 'reel-demo', 'reel-explainer', 'post-spotlight', 'post-statement'];
export const isVideo = kind => kind.startsWith('reel-');

/** Validate + enrich: fills exact verse text so templates and reviewers see the real words. */
export async function prepare(raw) {
  const spec = Spec.parse(raw);
  const { getVerse } = await import('./verses.mjs');
  if (spec.ref) spec.verse = getVerse(spec.ref);
  if (spec.kind === 'reel-explainer') for (const l of spec.lines) if (l.verse) l.verseData = getVerse(l.verse);
  return spec;
}
