// List projects. No dependencies, so workflows can call it before npm ci.
//   node engine/cli/projects.mjs            table
//   node engine/cli/projects.mjs --json     ["bijbelstudie", ...] (enabled only) - for workflow matrices
//   node engine/cli/projects.mjs --current  the project this environment resolves to (PROJECT, else the default)
//   node engine/cli/projects.mjs --json --only <id>   ["<id>"] if that project exists, else exit 1
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../paths.mjs';
import { listProjects, currentProjectId } from '../project.mjs';

const cfg = join(ROOT, 'engine.config');
if (!process.env.DEFAULT_PROJECT && existsSync(cfg)) process.env.DEFAULT_PROJECT = /^DEFAULT_PROJECT=(.+)$/m.exec(readFileSync(cfg, 'utf8'))?.[1]?.trim();

const [flag, opt, only] = process.argv.slice(2);
const known = id => listProjects({ all: true }).some(p => p.id === id) || (console.error(`unknown project "${id}"`), process.exit(1));
if (flag === '--json' && opt === '--only' && only) { known(only); console.log(JSON.stringify([only])); }
else if (flag === '--json') console.log(JSON.stringify(listProjects().map(p => p.id)));
else if (flag === '--current') { const id = currentProjectId(); known(id); console.log(id); }
else for (const p of listProjects({ all: true })) console.log(`${p.enabled === false ? 'off' : 'on '}  ${p.id.padEnd(16)} ${p.name.padEnd(16)} db=${p.db}  env=${p.envPrefix || '(none)'}`);
