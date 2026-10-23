// Configuration for the engine, in order of precedence:
//   1. real environment variables (GitHub Actions secrets, your shell)
//   2. .env.engine   - LOCAL ONLY, gitignored; secrets for running the engine on your own machine
//   3. engine.config - committed, NON-secret settings (URLs, database name, project)
// Secrets (MONGODB_URI, ENGINE_KEY, API keys, tokens) never go in a committed file.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

for (const name of ['.env.engine', 'engine.config']) {
  const file = join(ROOT, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
