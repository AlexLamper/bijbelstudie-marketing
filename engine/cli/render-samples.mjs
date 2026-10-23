// Render every sample spec of the current project to out/<project>/ (npm run samples does all projects).
import '../env.mjs';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../project.mjs';
import { renderSpec, launch } from '../render/render.mjs';

const dir = project().paths.samples;
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : [];
const browser = await launch();
for (const f of files) {
  const r = await renderSpec(JSON.parse(readFileSync(join(dir, f), 'utf8')), { browser });
  console.log(`${r.id}: ${Object.values(r.files).join(', ')}`);
}
await browser.close();
