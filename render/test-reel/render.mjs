// Renders reel.html frame by frame with headless Chromium, then encodes an MP4 with ffmpeg.
// Usage: node render.mjs <out.mp4> [seconds=4] [fps=30]
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/npm-tools/node_modules/playwright'); }

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, 'test-reel.mp4');
const seconds = Number(process.argv[3] || 4);
const fps = Number(process.argv[4] || 30);
const frames = Math.round(seconds * fps);
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'reel-'));

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(here, 'reel.html')).href);
await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });

for (let i = 0; i < frames; i++) {
  await page.evaluate(t => window.render(t), i / fps);
  await page.screenshot({ path: join(dir, `f${String(i).padStart(4, '0')}.png`) });
}
await browser.close();

// H.264 + silent AAC track (some platforms reject video without audio), yuv420p, faststart for mobile playback
execFileSync('ffmpeg', ['-loglevel', 'error', '-y',
  '-framerate', String(fps), '-i', join(dir, 'f%04d.png'),
  '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-shortest', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${out} (${frames} frames @ ${fps}fps)`);
