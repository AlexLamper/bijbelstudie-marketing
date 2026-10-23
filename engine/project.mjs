// Projects: one engine and one studio, any number of brands (BijbelStudie, BijbelQuiz, ...).
// Each brand is a folder projects/<id>/ with project.json, brand/, plan.md, assets/ and content/.
// Shared across projects: engine/, planner/, assets/ (fonts, store badges), data/ (Bible text).
//
// Which project a script works on:
//   1. PROJECT env var (set by engine/cli/each.mjs and the workflows)
//   2. a path argument inside projects/<id>/ (e.g. render.mjs projects/bijbelquiz/content/samples/x.json)
//   3. DEFAULT_PROJECT from engine.config
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

export const PROJECTS_DIR = join(ROOT, 'projects');
export const SHARED_ASSETS = join(ROOT, 'assets');

const DEFAULTS = {
  enabled: true,
  language: 'nl',
  timezone: 'Europe/Amsterdam',
  platforms: ['instagram', 'facebook', 'tiktok', 'youtube'],
  theme: {
    accent: '#0d9488', accentDark: '#0f766e', accentSoft: '#ccfbf1', accentFaint: '#f0fdfa',
    cta: '#0d7a66', panel: '#152229', ink: '#111827', inkBody: '#374151', inkMuted: '#6b7280',
    background: '#f3f4f6', surface: '#ffffff', line: '#e5e7eb',
    fontSans: 'Inter', fontSerif: 'Lora',
  },
  logos: {
    full: 'logos/logo-full.svg',              // on light grounds
    iconOnDark: 'logos/logo-icon-dark.svg',   // on dark grounds
    wordmarkOnDark: 'logos/logo-wordmark-white.svg',
  },
  endCard: { buttons: ['Download gratis', 'Begin gratis'], stores: ['app-store', 'play-store'] },
  verse: { translation: 'SV', eyebrow: 'VERS VAN DE DAG' },
};

/** Project config with defaults filled in and absolute paths. */
export function loadProject(id) {
  const dir = join(PROJECTS_DIR, id);
  const file = join(dir, 'project.json');
  if (!existsSync(file)) throw new Error(`Unknown project "${id}" (no projects/${id}/project.json)`);
  const cfg = JSON.parse(readFileSync(file, 'utf8'));
  const p = {
    ...DEFAULTS, ...cfg, id,
    theme: { ...DEFAULTS.theme, ...cfg.theme },
    logos: { ...DEFAULTS.logos, ...cfg.logos },
    endCard: { ...DEFAULTS.endCard, ...cfg.endCard },
    verse: { ...DEFAULTS.verse, ...cfg.verse },
  };
  p.db ??= `${id.replace(/-/g, '_')}_marketing`;
  p.envPrefix ??= `${id.toUpperCase().replace(/-/g, '_')}_`;
  p.dir = dir;
  p.paths = {
    brand: join(dir, 'brand'), plan: join(dir, 'plan.md'),
    assets: join(dir, 'assets'), screenshots: join(dir, 'assets', 'screenshots'), photos: join(dir, 'assets', 'photos'),
    content: join(dir, 'content'), queue: join(dir, 'content', 'queue'), imported: join(dir, 'content', 'imported'),
    context: join(dir, 'content', 'context'), samples: join(dir, 'content', 'samples'),
    usedVerses: join(dir, 'content', 'used-verses.json'), competitors: join(dir, 'content', 'competitors.json'),
  };
  return p;
}

/** All projects (enabled only unless all: true), in display order. */
export function listProjects({ all = false } = {}) {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR)
    .filter(d => !d.startsWith('_') && !d.startsWith('.') && existsSync(join(PROJECTS_DIR, d, 'project.json')))
    .map(loadProject)
    .filter(p => all || p.enabled !== false)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.id.localeCompare(b.id));
}

export function currentProjectId() {
  if (process.env.PROJECT) return process.env.PROJECT;
  const fromArg = process.argv.slice(2).join(' ').replace(/\\/g, '/').match(/(?:^|[\s/])projects\/([a-z0-9-]+)\//);
  if (fromArg) return fromArg[1];
  return process.env.DEFAULT_PROJECT || listProjects()[0]?.id;
}

let current;
/** The project this process works on. */
export function project() {
  if (current) return current;
  const id = currentProjectId();
  if (!id) throw new Error('No project: set PROJECT, or add projects/<id>/project.json');
  return (current = loadProject(id));
}

/** First existing file: the project's assets, then the shared assets/. */
export function assetPath(rel, p = project()) {
  for (const base of [p.paths.assets, SHARED_ASSETS]) { const f = join(base, rel); if (existsSync(f)) return f; }
  return null;
}

// Env vars that point at an account (where things get posted, whose users get counted).
// For a project with an envPrefix, only <PREFIX><KEY> is used for these - never the unprefixed
// value of another project. Everything else (app credentials, voices) may be shared.
export const ACCOUNT_KEYS = ['META_PAGE_TOKEN', 'IG_USER_ID', 'FB_PAGE_ID', 'YT_REFRESH_TOKEN', 'TIKTOK_REFRESH_TOKEN',
  'UPLOADPOST_USER', 'PLATFORM_MONGODB_URI', 'PLATFORM_MONGODB_DB'];
