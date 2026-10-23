// Render sample specs of the current project to out/<project>/ (npm run samples does all projects).
//   node engine/cli/render-samples.mjs [name-filter] [--upload]
// --upload (used by .github/workflows/samples.yml): with real voices (studio keys) and music, and
// puts every file in Blob storage, printing its public URL - to listen to a format before it goes live.
import '../env.mjs';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { renderSpec, launch } from '../render/render.mjs';

const args = process.argv.slice(2); const doUpload = args.includes('--upload'); const filter = args.find(a => !a.startsWith('--'));
let d = null;
if (doUpload) { const { db } = await import('../db.mjs'); d = await db(); await (await import('../library.mjs')).loadVoices(d); }
const dir = project().paths.samples;
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json') && (!filter || f.includes(filter))) : [];
const browser = await launch();
for (const f of files) {
  const r = await renderSpec(JSON.parse(readFileSync(join(dir, f), 'utf8')), { browser });
  const list = [r.files.media, ...(r.files.slides?.slice(1) || []), r.files.cover].filter(Boolean);
  if (doUpload) {
    const { upload } = await import('../storage/index.mjs'); const v = Date.now();
    for (const x of list) console.log(`${r.id}: ${await upload(x, `${project().id}/samples/${r.id}/${v}-${x.split('/').pop()}`)}`);
  } else console.log(`${r.id}: ${list.join(', ')}`);
  if (r.notes.length) console.log(`  notes: ${r.notes.join('; ')}`);
}
await browser.close();
if (d) await (await import('../db.mjs')).close();
