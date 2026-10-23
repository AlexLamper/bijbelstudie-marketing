// Loads .env.engine (private repo, Alex's choice) for any variable that is not already set.
// GitHub Actions secrets with the same name win: an empty or missing variable is filled from the file.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.mjs';

const file = join(ROOT, '.env.engine');
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}
