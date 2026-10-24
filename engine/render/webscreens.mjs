// Live screens from the project's website for reels: a spec may use "web:bijbel/<slug>/<chapter>" (the
// public chapter page in the Statenvertaling) or "web:bijbelboeken/<slug>" (the book page) wherever it
// can use an app screenshot. They are captured at phone size when the item renders, so what a video
// shows always matches the chapter it talks about (never a screenshot of another chapter).
// Only BijbelStudie (project.web = bijbelstudie.io) has these pages.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../paths.mjs';

export const WEB_RE = /^web:(bijbel\/([a-z0-9-]+)\/(\d+)|bijbelboeken\/([a-z0-9-]+))$/;
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const DATA = join(ROOT, 'data', 'statenvertaling');
const display = folder => folder === '2 Corinthiër' ? '2 Corinthiërs' : folder;   // as verses.mjs names it

/** Book name (as in the Statenvertaling data) -> the website's slug, e.g. "1 Samuël" -> "1-samuel". */
export const bookSlug = name => fold(display(name)).replace(/\s+/g, '-');
let books = null;
/** slug -> { name, chapters } for every book in the data. */
export function webBooks() {
  if (books) return books;
  books = {};
  if (existsSync(DATA)) for (const folder of readdirSync(DATA)) {
    const chapters = readdirSync(join(DATA, folder)).filter(f => f.endsWith('.json')).length;
    books[bookSlug(folder)] = { name: display(folder), chapters };
  }
  return books;
}
/** Is this a valid web screen key? Returns an error message or null. */
export function webKeyProblem(key) {
  const m = WEB_RE.exec(key); if (!m) return `"${key}" is not a web screen (use web:bijbel/<boek>/<hoofdstuk> or web:bijbelboeken/<boek>)`;
  const slug = m[2] || m[4]; const b = webBooks()[slug];
  if (!b) return `unknown book "${slug}" in ${key} - slugs: ${Object.keys(webBooks()).slice(0, 12).join(', ')}, ...`;
  if (m[3] && (+m[3] < 1 || +m[3] > b.chapters)) return `${b.name} has ${b.chapters} chapters (${key})`;
  return null;
}
/** What a web key shows: { book, chapter? }. */
export const webShows = key => { const m = WEB_RE.exec(key); if (!m) return null; const b = webBooks()[m[2] || m[4]]; return b ? { book: b.name, chapter: m[3] ? +m[3] : null } : null; };

/** Every screen key a spec uses (app/screen/screenshot fields anywhere in it). */
export function screensOf(spec) {
  const out = new Set();
  const walk = o => { if (!o || typeof o !== 'object') return; for (const [k, v] of Object.entries(o)) { if (['app', 'screen', 'screenshot'].includes(k) && typeof v === 'string') out.add(v); else if (typeof v === 'object') walk(v); } };
  walk(spec); return [...out];
}

/**
 * Capture the web screens a spec uses with the given Playwright browser. Returns { key: { url, w, h } }
 * to merge into the stage context's shots. The cookie banner is answered "only necessary" up front, so it
 * never shows and no analytics run.
 */
export async function captureWebScreens(browser, spec, dir, site) {
  const keys = screensOf(spec).filter(k => WEB_RE.test(k)); const shots = {};
  if (!keys.length) return shots;
  const base = `https://www.${String(site || 'bijbelstudie.io').replace(/^https?:\/\//, '').replace(/^www\./, '')}`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'nl-NL' });
  await ctx.addInitScript(() => { try { localStorage.setItem('bs-cookie-consent-v2', JSON.stringify({ status: 'declined', date: new Date().toISOString() })); } catch {} });
  try {
    for (const key of keys) {
      const path = '/' + key.slice(4);
      const page = await ctx.newPage();
      let last;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 });
          if (!r || r.status() >= 400) throw new Error(`HTTP ${r?.status()}`);
          await page.evaluate(() => document.fonts?.ready); await page.waitForTimeout(400);
          const f = join(dir, `web-${key.slice(4).replace(/[^a-z0-9]+/g, '-')}.png`);
          writeFileSync(f, await page.screenshot({ type: 'png' }));
          shots[key] = { url: pathToFileURL(f).href, w: 1170, h: 2532 }; last = null; break;
        } catch (e) { last = e; await page.waitForTimeout(1500); }
      }
      await page.close();
      if (last) throw new Error(`Web screen ${base}${path} could not be captured: ${last.message.split('\n')[0]}`);
    }
  } finally { await ctx.close(); }
  return shots;
}
