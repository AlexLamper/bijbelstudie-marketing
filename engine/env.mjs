// Configuration for the engine, in order of precedence:
//   1. real environment variables (your shell, GitHub Actions)
//   2. SECRETS - all GitHub Actions secrets as JSON (workflows pass ${{ toJSON(secrets) }}),
//      so a new secret works without editing any workflow
//   3. .env.engine   - LOCAL ONLY, gitignored; secrets for running the engine on your own machine
//   4. engine.config - committed, NON-secret settings (URLs, default project)
// Secrets (MONGODB_URI, ENGINE_KEY, API keys, tokens) never go in a committed file.
//
// Then the project's own values are applied: with envPrefix "BIJBELQUIZ_", BIJBELQUIZ_IG_USER_ID
// becomes IG_USER_ID for this process, and account keys without the prefix are dropped.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';
import { project, ACCOUNT_KEYS } from './project.mjs';

const setIfMissing = (k, v) => { if (/^[A-Z][A-Z0-9_]*$/.test(k) && process.env[k] === undefined && v !== '' && v != null) process.env[k] = String(v); };

if (process.env.SECRETS) {
  try {
    const all = JSON.parse(process.env.SECRETS);
    globalThis.__secretNames = Object.keys(all).filter(k => /^[A-Z][A-Z0-9_]*$/.test(k)).sort();   // names only, for the studio's checklist
    for (const [k, v] of Object.entries(all)) setIfMissing(k, v);
  }
  catch { console.error('SECRETS is not valid JSON - ignored'); }
  delete process.env.SECRETS;
}
for (const name of ['.env.engine', 'engine.config']) {
  const file = join(ROOT, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    setIfMissing(m[1], m[2].replace(/^["']|["']$/g, ''));
  }
}

const p = project();
process.env.PROJECT = p.id;
if (p.envPrefix) {
  for (const k of ACCOUNT_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith(p.envPrefix) && k.length > p.envPrefix.length) process.env[k.slice(p.envPrefix.length)] = v;
}
