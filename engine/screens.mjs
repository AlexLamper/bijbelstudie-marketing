// Does a video show an app screen of another chapter than it talks about? (Alex: never.) The app
// screenshots say what they show in projects/<id>/assets/screenshots/screens.json; live web screens
// (web:bijbel/<boek>/<hoofdstuk>) show their own chapter. Checked by the validator and on import.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { project } from './project.mjs';
import { WEB_RE, webShows, webBooks, screensOf } from './render/webscreens.mjs';
import { parseRef } from './verses.mjs';

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const base = name => fold(name).replace(/^\d\s*/, '').replace(/^psalm$/, 'psalmen').trim();
let meta = null;
const screensMeta = () => meta ||= (() => { const f = join(project().paths.screenshots, 'screens.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).screens : {}; })();

/** Book bases an item is about: from its verse references and Bible book names in what it says or shows. */
export function booksOf(spec) {
  const out = new Set(); const names = [...new Set(Object.values(webBooks()).map(b => base(b.name)))];
  const refs = []; const texts = [];
  const walk = o => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') { if (['ref', 'verse', 'verseRef'].includes(k)) refs.push(v); else if (['say', 'line', 'hook', 'text', 'title', 'question', 'explain', 'headline', 'sub'].includes(k)) texts.push(v); }
    else if (typeof v === 'object' && !['verseData', 'verse'].includes(k)) walk(v); else if (k === 'verse' && typeof v === 'string') refs.push(v); } };
  walk(spec);
  for (const r of refs) { try { out.add(base(parseRef(r).book)); } catch { /* not a reference */ } }
  const t = ' ' + fold(texts.join(' ')).replace(/[^a-z0-9 ]+/g, ' ') + ' ';
  for (const n of names) if (n.length > 2 && t.includes(' ' + n + ' ')) out.add(n);
  if (t.includes(' psalm ')) out.add('psalmen');
  return out;
}
/** Problems: screens that show another chapter than the item is about. */
export function screenProblems(spec) {
  const problems = []; const books = booksOf(spec); const M = screensMeta();
  for (const key of screensOf(spec)) {
    if (M[key]?.avoid) problems.push(`screenshot ${key} shows Alex's own account - don't use it in videos`);
    const shows = WEB_RE.test(key) ? webShows(key)?.book : M[key]?.shows;
    if (!shows || !books.size) continue;
    if (!books.has(base(shows.replace(/\s+\d+$/, '')))) problems.push(`screen ${key} shows ${shows}, but this item is about ${[...books].join(', ')} - use a screen of the same chapter: web:bijbel/<boek>/<hoofdstuk> (e.g. web:bijbel/${Object.keys(webBooks()).find(s => base(webBooks()[s].name) === [...books][0]) || 'genesis'}/1) or a general one (07-studies, 13-boom-groeide, 17/18/19 onboarding)`);
  }
  return problems;
}
