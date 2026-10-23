// Run an engine script once per project, each in its own process with PROJECT set.
//   node engine/cli/each.mjs engine/cli/publish-due.mjs        every enabled project
//   node engine/cli/each.mjs --all engine/cli/validate.mjs     also projects with "enabled": false
//   PROJECT=bijbelquiz node engine/cli/each.mjs ...            just that one
// Keeps going when one project fails, and exits 1 at the end if any did.
import { spawn } from 'node:child_process';
import { listProjects, loadProject } from '../project.mjs';

const args = process.argv.slice(2);
const all = args[0] === '--all'; if (all) args.shift();
if (!args.length) { console.error('usage: node engine/cli/each.mjs [--all] <script.mjs> [args]'); process.exit(2); }
const projects = process.env.PROJECT ? [loadProject(process.env.PROJECT)] : listProjects({ all });

const run = p => new Promise(resolve => {
  const child = spawn(process.execPath, args, { env: { ...process.env, PROJECT: p.id }, stdio: ['ignore', 'pipe', 'pipe'] });
  const pipe = (from, to) => { let buf = ''; from.on('data', d => { buf += d; const lines = buf.split('\n'); buf = lines.pop(); for (const l of lines) to.write(l.startsWith(`[${p.id}]`) ? `${l}\n` : `[${p.id}] ${l}\n`); });
    from.on('end', () => buf && to.write(`[${p.id}] ${buf}\n`)); };
  pipe(child.stdout, process.stdout); pipe(child.stderr, process.stderr);
  child.on('close', code => resolve(code));
});

const failed = [];
for (const p of projects) if (await run(p)) failed.push(p.id);
if (!projects.length) console.log('no projects');
if (failed.length) { console.error(`failed for: ${failed.join(', ')}`); process.exit(1); }
