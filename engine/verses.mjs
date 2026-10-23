// Exact Statenvertaling text, straight from the website's own data (public domain, 1637).
// The planner only ever chooses a reference; the words always come from here, never from a model.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';
import { project } from './project.mjs';

const DIR = join(ROOT, 'data', 'statenvertaling');

// Folder names in the data, plus the spellings people (and models) actually write.
const ALIASES = {
  '2 corinthiers': '2 Corinthiër', '2 korintiers': '2 Corinthiër', '1 korintiers': '1 Corinthiërs',
  'matteus': 'Mattheüs', 'mattheus': 'Mattheüs', 'psalm': 'Psalmen', 'ps': 'Psalmen',
  'spr': 'Spreuken', 'jes': 'Jesaja', 'joh': 'Johannes', 'rom': 'Romeinen', 'fil': 'Filippenzen',
  'hand': 'Handelingen', 'openb': 'Openbaring', 'gen': 'Genesis', 'ex': 'Exodus',
};

const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let folders;
function folderFor(book) {
  folders ??= readdirSync(DIR);
  const f = fold(book);
  if (ALIASES[f]) return ALIASES[f];
  return folders.find(x => fold(x) === f) || folders.find(x => fold(x).startsWith(f));
}

/** "Johannes 3:16", "Psalmen 23:1-3" -> { book, chapter, from, to } */
export function parseRef(ref) {
  const m = /^\s*(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(ref);
  if (!m) throw new Error(`Bad reference: "${ref}"`);
  return { book: m[1], chapter: +m[2], from: +m[3], to: +(m[4] || m[3]) };
}

/** Returns { ref, book, text, verses:[{n,text}] } with the canonical book name and exact SV text. */
export function getVerse(ref) {
  const r = parseRef(ref);
  const folder = folderFor(r.book);
  if (!folder) throw new Error(`Unknown book: "${r.book}"`);
  const file = join(DIR, folder, `${folder}${r.chapter}.json`);
  if (!existsSync(file)) throw new Error(`No chapter: ${folder} ${r.chapter}`);
  const ch = JSON.parse(readFileSync(file, 'utf8'));
  const verses = [];
  for (let n = r.from; n <= r.to; n++) {
    if (!ch[n]) throw new Error(`No verse: ${folder} ${r.chapter}:${n}`);
    verses.push({ n, text: ch[n].trim() });
  }
  const name = folder === '2 Corinthiër' ? '2 Corinthiërs' : folder;
  const canonical = `${name} ${r.chapter}:${r.from}${r.to > r.from ? '-' + r.to : ''}`;
  return { ref: canonical, book: name, text: verses.map(v => v.text).join(' '), verses };
}

// ---- used-verse ledger: a verse that went out is never used again ----
// per project: projects/<id>/content/used-verses.json (exported from Mongo before every planner run)
export function usedVerses() {
  const f = project().paths.usedVerses;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).verses.map(v => v.ref) : [];
}
const key = ref => { const r = parseRef(ref); return `${fold(folderFor(r.book) || r.book)} ${r.chapter}:${r.from}-${r.to}`; };
export function isUsed(ref, extra = []) {
  const k = key(ref);
  return [...usedVerses(), ...extra].some(u => { try { return key(u) === k; } catch { return false; } });
}
