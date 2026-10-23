// spec -> media. Images (1080x1350 JPEG) for posts, MP4 (1080x1920, H.264 + AAC) for reels.
// Runs headless Chromium frame by frame, then ffmpeg. Used locally and in GitHub Actions.
import '../env.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { prepare, isVideo, PHOTO_DIR } from '../spec.mjs';
import { OUT } from '../paths.mjs';
import { project, assetPath } from '../project.mjs';
import { synthesize, ttsConfigured } from '../tts/index.mjs';

const require = createRequire(import.meta.url);
const pw = (() => { try { return require('playwright'); } catch { return require('/opt/npm-tools/node_modules/playwright'); } })();
const STAGE = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), 'stage.html')).href;
const FPS = 30;

/** Everything project-specific the templates need: theme, logo/badge/photo/screenshot URLs, texts. */
export function stageContext(p = project()) {
  const url = f => f && pathToFileURL(f).href;
  const need = (rel, what) => { const f = assetPath(rel, p); if (!f) throw new Error(`${p.name}: missing ${what} (projects/${p.id}/assets/${rel})`); return url(f); };
  const shots = {};
  if (existsSync(p.paths.screenshots)) for (const f of readdirSync(p.paths.screenshots).filter(f => f.endsWith('.png'))) {
    const file = join(p.paths.screenshots, f); const b = readFileSync(file).subarray(16, 24);   // PNG IHDR: width, height
    shots[f.slice(0, -4)] = { url: url(file), w: b.readUInt32BE(0), h: b.readUInt32BE(4) };
  }
  return {
    theme: p.theme,
    logos: { full: need(p.logos.full, 'logo for light grounds'), iconOnDark: need(p.logos.iconOnDark, 'logo icon for dark grounds'), wordmarkOnDark: need(p.logos.wordmarkOnDark, 'wordmark for dark grounds') },
    badges: (p.endCard.stores || []).map(s => need(`badges/${s}.png`, `${s} badge`)),
    fonts: (p.fonts || []).map(f => ({ ...f, url: need(f.file, `font ${f.file}`) })),
    photoBase: url(PHOTO_DIR) + '/', shotBase: url(p.paths.screenshots) + '/', shots,
    endCard: { headline: p.endCard.headline, sub: p.endCard.sub, button: p.endCard.buttons[0], web: p.endCard.web },
    verse: p.verse,
  };
}

const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

/** Voice for explainers: one clip per spoken unit, so line timing is exact. */
async function voiceTrack(spec, work) {
  if (spec.kind !== 'reel-explainer') return null;
  const units = [spec.hook, ...spec.lines.map(l => l.say)];
  if (!ttsConfigured()) return { timing: null, file: null, note: 'Nog geen stem ingesteld - gemaakt zonder stem (Instellingen > Sleutels/Stemmen, daarna Opnieuw renderen)' };
  const clips = [];
  for (const [i, text] of units.entries()) {
    const f = join(work, `v${i}.mp3`);
    writeFileSync(f, await synthesize(text, spec.voice, { previous: units.slice(0, i).join(' ').slice(-400) || undefined, next: units[i + 1] }));
    clips.push({ f, dur: probe(f) });
  }
  // lay clips on the same clock the template uses: start .3s, .25s gap between units
  const parts = []; let at = 0.3;
  const filters = clips.map((c, i) => { const d = Math.round(at * 1000); at += c.dur + .25; parts.push(`[${i}:a]adelay=${d}|${d}[a${i}]`); return `[a${i}]`; });
  const file = join(work, 'voice.m4a');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...clips.flatMap(c => ['-i', c.f]),
    '-filter_complex', `${parts.join(';')};${filters.join('')}amix=inputs=${clips.length}:normalize=0,aresample=44100[out]`,
    '-map', '[out]', '-c:a', 'aac', '-b:a', '160k', file]);
  return { timing: clips.map(c => c.dur), file };
}

export async function renderSpec(raw, { outDir = join(OUT, project().id), browser: shared } = {}) {
  const spec = await prepare(raw);
  const dir = join(outDir, spec.id); mkdirSync(dir, { recursive: true });
  const work = mkdtempSync(join(process.env.TMPDIR || tmpdir(), `r-${spec.id}-`));
  const browser = shared || await pw.chromium.launch();
  try {
    const voice = await voiceTrack(spec, work);
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.goto(STAGE);
    const info = await page.evaluate(([s, t, c]) => window.setup(s, t, c), [spec, voice?.timing ?? null, stageContext()]);
    await page.setViewportSize({ width: info.width, height: info.height });
    const result = { id: spec.id, kind: spec.kind, files: {}, duration: info.duration, notes: [] };

    if (!isVideo(spec.kind)) {
      const f = join(dir, `${spec.id}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
      result.files.media = f;
    } else {
      const frames = Math.round(info.duration * FPS);
      for (let i = 0; i < frames; i++) {
        await page.evaluate(t => window.render(t), i / FPS);
        await page.screenshot({ path: join(work, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      }
      const media = join(dir, `${spec.id}.mp4`);
      const audio = voice?.file ? ['-i', voice.file] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(work, 'f%05d.jpg'), ...audio,
        '-map', '0:v', '-map', '1:a', '-t', info.duration.toFixed(3), '-af', 'apad',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
        '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', media]);
      // cover: a moment with the hook / verse fully visible
      const cover = join(dir, `${spec.id}-cover.jpg`);
      await page.evaluate(t => window.render(t), Math.min(2.4, info.duration / 3));
      await page.screenshot({ path: cover, type: 'jpeg', quality: 90 });
      result.files = { media, cover };
      if (voice?.note) result.notes.push(voice.note);
    }
    await page.close();
    writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
    return result;
  } finally {
    if (!shared) await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
}

export const launch = () => pw.chromium.launch();

// CLI: node engine/render/render.mjs projects/<id>/content/samples/x.json [more.json ...]
// (the project comes from the path, or PROJECT)
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await launch();
  for (const f of process.argv.slice(2)) {
    const r = await renderSpec(JSON.parse(readFileSync(f, 'utf8')), { browser });
    console.log(`${r.id}: ${Object.values(r.files).join(', ')} ${r.duration ? `(${r.duration.toFixed(1)}s)` : ''} ${r.notes.join('; ')}`);
  }
  await browser.close();
}
