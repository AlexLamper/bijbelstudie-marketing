// spec -> media. Images (1080x1350 JPEG) for posts and carousel slides, MP4 (1080x1920, H.264 + AAC)
// for reels. Runs headless Chromium frame by frame, then ffmpeg. Used locally and in GitHub Actions.
// Sound: the template says what is spoken (T[kind].units), we voice it, the template lays it out
// and returns the start of every unit, then the voice is mixed with a music bed ducked underneath.
import '../env.mjs';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { prepare, isVideo, PHOTO_DIR, PHOTO_COUNT } from '../spec.mjs';
import { OUT } from '../paths.mjs';
import { project, assetPath } from '../project.mjs';
import { synthesize, ttsConfigured } from '../tts/index.mjs';
import { musicFor } from './music.mjs';

const require = createRequire(import.meta.url);
const pw = (() => { try { return require('playwright'); } catch { return require('/opt/npm-tools/node_modules/playwright'); } })();
const HERE = dirname(fileURLToPath(import.meta.url));
const STAGE = pathToFileURL(join(HERE, 'stage.html')).href;
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
  const data = f => existsSync(join(HERE, 'data', f)) ? JSON.parse(readFileSync(join(HERE, 'data', f), 'utf8')) : null;
  return {
    theme: p.theme,
    logos: { full: need(p.logos.full, 'logo for light grounds'), iconOnDark: need(p.logos.iconOnDark, 'logo icon for dark grounds'), wordmarkOnDark: need(p.logos.wordmarkOnDark, 'wordmark for dark grounds') },
    badges: (p.endCard.stores || []).map(s => need(`badges/${s}.png`, `${s} badge`)),
    fonts: (p.fonts || []).map(f => ({ ...f, url: need(f.file, `font ${f.file}`) })),
    photoBase: url(PHOTO_DIR) + '/', photoCount: PHOTO_COUNT, shotBase: url(p.paths.screenshots) + '/', shots,
    endCard: { headline: p.endCard.headline, sub: p.endCard.sub, button: p.endCard.buttons[0], web: p.endCard.web },
    verse: p.verse, name: p.name, web: p.web,
    places: data('places.json')?.places || {}, map: data('map.json'),
  };
}

const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

/** Voice every spoken unit separately, so each unit's timing is exact. */
async function voiceClips(spec, units, work) {
  if (!units?.length) return null;
  if (!ttsConfigured()) return { timing: null, clips: [], note: 'Nog geen stem ingesteld - gemaakt zonder stem (Instellingen > Sleutels/Stemmen, daarna Opnieuw renderen)' };
  const clips = [];
  for (const [i, u] of units.entries()) {
    const f = join(work, `v${i}.mp3`);
    const { audio, words } = await synthesize(u.text, spec.voice, { style: spec.voiceStyle, previous: units.slice(0, i).map(x => x.text).join(' ').slice(-400) || undefined, next: units[i + 1]?.text });
    writeFileSync(f, audio); clips.push({ f, dur: probe(f), words });
  }
  return { timing: clips.map(c => ({ dur: c.dur, words: c.words })), clips };
}

/** Voice clips at their starts + music bed (ducked under the voice), loudness-normalised for social. */
function mixAudio({ clips = [], starts, music, duration, work }) {
  if (!clips.length && !music) return null;
  const args = ['-loglevel', 'error', '-y']; const f = []; let n = 0;
  clips.forEach(c => { args.push('-i', c.f); n++; });
  if (clips.length) {
    clips.forEach((c, i) => { const d = Math.round((starts?.[i] ?? .3) * 1000); f.push(`[${i}:a]aresample=44100,adelay=${d}|${d}[a${i}]`); });
    f.push(`${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest[voice]`);
  }
  if (music) {
    args.push('-stream_loop', '-1', '-i', music); const m = n;
    const vol = clips.length ? 0.32 : 0.75;
    f.push(`[${m}:a]aresample=44100,atrim=0:${duration.toFixed(2)},asetpts=N/SR/TB,volume=${vol},afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, duration - 1.8).toFixed(2)}:d=1.8[music]`);
  }
  // the voice is padded to the full length: the ducker (and so the music) would otherwise stop at the last word
  const D = duration.toFixed(2), STEREO = 'aformat=channel_layouts=stereo';
  if (clips.length && music) f.push(`[voice]apad=whole_dur=${D},${STEREO},asplit=2[v1][v2]`, `[music]${STEREO}[m2]`, '[m2][v2]sidechaincompress=threshold=0.025:ratio=12:attack=20:release=400[duck]', `[v1][duck]amix=inputs=2:normalize=0:duration=longest,${STEREO},loudnorm=I=-14:TP=-1.5:LRA=11[out]`);
  else if (clips.length) f.push(`[voice]apad=whole_dur=${D},${STEREO},loudnorm=I=-14:TP=-1.5:LRA=11[out]`);
  else f.push(`[music]${STEREO},loudnorm=I=-16:TP=-1.5:LRA=11[out]`);
  const file = join(work, 'sound.m4a');
  execFileSync('ffmpeg', [...args, '-filter_complex', f.join(';'), '-map', '[out]', '-t', duration.toFixed(3), '-ar', '44100', '-c:a', 'aac', '-b:a', '160k', file]);
  return file;
}

export async function renderSpec(raw, { outDir = join(OUT, project().id), browser: shared } = {}) {
  const spec = await prepare(raw);
  const dir = join(outDir, spec.id); mkdirSync(dir, { recursive: true });
  const work = mkdtempSync(join(process.env.TMPDIR || tmpdir(), `r-${spec.id}-`));
  const browser = shared || await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    await page.goto(STAGE);
    const units = isVideo(spec.kind) ? await page.evaluate(s => window.units(s), spec) : null;
    const voice = await voiceClips(spec, units, work);
    const info = await page.evaluate(([s, t, c]) => window.setup(s, t, c), [spec, voice?.timing ?? null, stageContext()]);
    await page.setViewportSize({ width: info.width, height: info.height });
    const result = { id: spec.id, kind: spec.kind, files: {}, duration: info.duration, notes: [] };

    if (spec.kind === 'carousel') {
      const slides = [];
      for (let i = 0; i < info.slides; i++) {
        await page.evaluate(i => window.slide(i), i);
        const f = join(dir, `${spec.id}-${String(i + 1).padStart(2, '0')}.jpg`);
        await page.screenshot({ path: f, type: 'jpeg', quality: 92 }); slides.push(f);
      }
      result.files = { media: slides[0], slides };
    } else if (!isVideo(spec.kind)) {
      const f = join(dir, `${spec.id}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 92 });
      result.files.media = f;
    } else {
      const frames = Math.round(info.duration * FPS);
      for (let i = 0; i < frames; i++) {
        await page.evaluate(t => window.render(t), i / FPS);
        await page.screenshot({ path: join(work, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
      }
      const music = musicFor(spec.music, spec.id);
      if (spec.music && spec.music !== 'none' && !music) result.notes.push(`Nog geen muziek voor "${spec.music}" in de bibliotheek - gemaakt zonder muziek`);
      const sound = mixAudio({ clips: voice?.clips, starts: info.starts, music, duration: info.duration, work });
      const media = join(dir, `${spec.id}.mp4`);
      const audio = sound ? ['-i', sound] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
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
// (the project comes from the path, or PROJECT). --frames=1.2,5 also writes stills at those seconds.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await launch();
  for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
    const r = await renderSpec(JSON.parse(readFileSync(f, 'utf8')), { browser });
    console.log(`${r.id}: ${[r.files.media, ...(r.files.slides?.slice(1) || []), r.files.cover].filter(Boolean).map(x => x.split('/').pop()).join(', ')} ${r.duration ? `(${r.duration.toFixed(1)}s)` : ''} ${r.notes.join('; ')}`);
  }
  await browser.close();
}
