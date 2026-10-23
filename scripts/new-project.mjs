// Add a project (brand) to the engine and the studio:
//
//   npm run new-project -- bijbelquiz --name BijbelQuiz --web bijbelquiz.com --accent "#35548c"
//
// Options: --name (required), --web, --accent, --panel, --cta, --headline,
//          --logo-dark <file>      square mark for dark grounds (end card, verse images)
//          --logo-full <file>      logo for light grounds (posts)
//          --wordmark-white <file> name in white for dark grounds
// Without logo files it draws placeholders from the name and colours, so rendering works at once.
// The new project starts with "enabled": false - nothing is planned or posted until you switch it on.
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../engine/paths.mjs';

const [id, ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !opt.name) {
  console.error('usage: npm run new-project -- <id: lowercase, e.g. bijbelquiz> --name "BijbelQuiz" [--web bijbelquiz.com] [--accent "#35548c"]');
  process.exit(2);
}
const dir = join(ROOT, 'projects', id);
if (existsSync(dir)) { console.error(`projects/${id} already exists`); process.exit(1); }

// ---- colours: everything derives from one accent unless given ----
const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) throw new Error(`not a colour: ${h}`); return m[1].match(/../g).map(x => parseInt(x, 16)); };
const toHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const accent = opt.accent || '#0d9488';
const theme = {
  accent, accentDark: mix(accent, '#000000', 0.22), accentSoft: mix(accent, '#ffffff', 0.8), accentFaint: mix(accent, '#ffffff', 0.94),
  cta: opt.cta || mix(accent, '#000000', 0.15), panel: opt.panel || mix(accent, '#0b1220', 0.82),
};
const web = opt.web || `${id}.app`;
const vars = {
  name: opt.name, db: `${id.replace(/-/g, '_')}_marketing`, envPrefix: `${id.toUpperCase().replace(/-/g, '_')}_`, web,
  headline: opt.headline || `Ontdek ${opt.name}.`, ...theme,
};
const fill = s => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

// ---- copy the template, filling {{placeholders}} in text files ----
cpSync(join(ROOT, 'projects', '_template'), dir, { recursive: true });
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk(dir)) if (['.json', '.md'].includes(extname(f))) writeFileSync(f, fill(readFileSync(f, 'utf8')));
const cfg = JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8'));
if (!opt.web) cfg.endCard.web = ''; // no website line until there is one
writeFileSync(join(dir, 'project.json'), JSON.stringify(cfg, null, 2) + '\n');

// ---- logos: given files, or placeholders ----
const logos = join(dir, 'assets', 'logos');
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initial = esc(opt.name[0].toUpperCase());
const textW = Math.round(opt.name.length * 66);
const placeholders = {
  'logo-icon-dark.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="6" y="6" width="500" height="500" rx="112" fill="${theme.panel}" stroke="#fff" stroke-width="8"/><text x="256" y="256" dy=".35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="280" fill="#fff">${initial}</text></svg>`,
  'logo-wordmark-white.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${textW} 140"><text x="0" y="104" textLength="${textW}" lengthAdjust="spacingAndGlyphs" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="120" fill="#fff">${esc(opt.name)}</text></svg>`,
  'logo-full.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${textW + 170} 140"><rect x="0" y="10" width="120" height="120" rx="28" fill="${theme.accent}"/><text x="60" y="70" dy=".35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="72" fill="#fff">${initial}</text><text x="150" y="104" textLength="${textW}" lengthAdjust="spacingAndGlyphs" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="100" fill="${theme.panel}">${esc(opt.name)}</text></svg>`,
};
const given = { 'logo-icon-dark.svg': opt['logo-dark'], 'logo-full.svg': opt['logo-full'], 'logo-wordmark-white.svg': opt['wordmark-white'] };
for (const [file, svg] of Object.entries(placeholders)) {
  const src = given[file];
  if (src) {
    const target = file.replace(/\.svg$/, extname(src));           // keep the real file type (svg or png)
    copyFileSync(src, join(logos, target));
    if (target !== file) { cfg.logos[{ 'logo-icon-dark.svg': 'iconOnDark', 'logo-full.svg': 'full', 'logo-wordmark-white.svg': 'wordmarkOnDark' }[file]] = `logos/${target}`; }
  } else writeFileSync(join(logos, file), svg);
}
writeFileSync(join(dir, 'project.json'), JSON.stringify(cfg, null, 2) + '\n');

execFileSync(process.execPath, [join(ROOT, 'scripts', 'sync-projects.mjs')], { stdio: 'inherit' });
console.log(`
Created projects/${id}/ ("${opt.name}", database ${vars.db}, switched off).

Next:
  1. Fill in projects/${id}/brand/*.md and plan.md (the planner only says what product.md says).
  2. Put real logos in assets/logos/ and app screenshots in assets/screenshots/.
  3. Check a render:  node engine/render/render.mjs projects/${id}/content/samples/sample-post-statement.json
  4. Accounts: add GitHub secrets with the prefix ${vars.envPrefix} (e.g. ${vars.envPrefix}IG_USER_ID, ${vars.envPrefix}META_PAGE_TOKEN).
  5. Switch on: "enabled": true in projects/${id}/project.json, then commit and push.
     The studio shows the project after the next deploy; the planner picks it up next Friday.
`);
