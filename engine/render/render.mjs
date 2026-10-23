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
import { execFileSync, spawnSync } from 'node:child_process';
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

// One voice per video. The whole script is voiced in ONE request - one take, so the voice cannot drift
// between lines (separately generated lines can sound like different speakers). The take is then cut
// into the template's units: by the character timings ElevenLabs returns, or, when a model gives none,
// at the longest silences. A script too long for one request is voiced in as few takes as possible,
// all with the same seed and the text around them as context.
const SEP = '\n\n';
const MAX_CHARS = { eleven_v3: 2800 };
const seedOf = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 4294967295; };
const cut = (src, from, to, out) => { execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-ss', Math.max(0, from).toFixed(3), ...(to != null ? ['-to', to.toFixed(3)] : []), '-ar', '44100', '-ac', '1', out]); return out; };

/** Per unit: [first, last] alignment index and its words, matched on non-space characters (whitespace may be normalised). */
export function unitsFromAlignment(al, texts) {
  if (!al?.characters?.length) return null;
  const S = al.character_start_times_seconds, E = al.character_end_times_seconds;
  const ink = []; al.characters.forEach((c, k) => { if (!/\s/.test(c)) ink.push(k); });
  const want = texts.map(t => t.replace(/\s+/g, ''));
  if (ink.length !== want.reduce((n, t) => n + t.length, 0) || ink.map(k => al.characters[k]).join('') !== want.join('')) return null;
  let at = 0;
  return want.map(t => {
    const ks = ink.slice(at, at + t.length); at += t.length;
    const words = []; let cur = null, prev = -1;
    for (const k of ks) {
      if (cur && k !== prev + 1) { words.push(cur); cur = null; }   // a gap in the indices = whitespace
      if (!cur) cur = { w: '', a: S[k], b: E[k] };
      cur.w += al.characters[k]; cur.b = E[k]; prev = k;
    }
    if (cur) words.push(cur);
    return { a: S[ks[0]], b: E[ks.at(-1)], words };
  });
}
/** Fallback without timings: cut points at the (n-1) longest silences, in time order. */
function cutsFromSilence(file, n) {
  for (const [noise, d] of [['-38dB', 0.2], ['-32dB', 0.12]]) { const c = silenceCuts(file, n, noise, d); if (c) return c; }
  return null;
}
function silenceCuts(file, n, noise, d) {
  const log = String(spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${noise}:d=${d}`, '-f', 'null', '-']).stderr || '');   // silencedetect logs to stderr
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
  const gaps = [...log.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m, i) => ({ mid: (starts[i] + +m[1]) / 2, d: +m[2] })).filter(g => Number.isFinite(g.mid) && g.mid > 0.3);
  if (gaps.length < n - 1) return null;
  return gaps.sort((a, b) => b.d - a.d).slice(0, n - 1).map(g => g.mid).sort((a, b) => a - b);
}

/** Group unit indexes into takes that fit one request. */
function takesOf(texts, max) {
  const takes = [[]]; let len = 0;
  texts.forEach((t, i) => { if (takes.at(-1).length && len + t.length + SEP.length > max) { takes.push([]); len = 0; } takes.at(-1).push(i); len += t.length + SEP.length; });
  return takes;
}

// Dialog (reel-3d): a unit may name its own voice. Every voice is still one take: all lines of one
// speaker are voiced together and cut apart, so a character never changes voice between lines.
export async function voiceClips(spec, units, work, say = synthesize) {   // say: injectable for tests
  if (!units?.length) return null;
  if (!ttsConfigured()) return { timing: null, clips: [], note: 'Nog geen stem ingesteld - gemaakt zonder stem (Instellingen > Sleutels/Stemmen, daarna Opnieuw renderen)' };
  const byVoice = new Map();
  units.forEach((u, i) => { const v = u.voice || spec.voice; if (!v || v === 'none') throw new Error(`Voice: line ${i + 1} has no voice`); if (!byVoice.has(v)) byVoice.set(v, []); byVoice.get(v).push(i); });
  const all = new Array(units.length);
  for (const [v, idx] of byVoice) {
    const part = await voiceOne({ ...spec, voice: v, id: byVoice.size > 1 ? `${spec.id}-${v}` : spec.id }, idx.map(i => units[i]), work, say, all.filter(Boolean).length);
    part.forEach((c, j) => { all[idx[j]] = c; });
  }
  return { timing: all.map(c => ({ dur: c.dur, words: c.words })), clips: all };
}

/** One voice: its units in as few takes as possible (one, unless very long), cut into clips. */
async function voiceOne(spec, units, work, say, offset) {
  const texts = units.map(u => u.text.trim());
  const max = spec.voiceStyle === 'levendig' ? MAX_CHARS.eleven_v3 : 9000;
  const seed = seedOf(spec.id); const clips = [];
  for (const [n, take] of takesOf(texts, max).entries()) {
    const part = take.map(i => texts[i]);
    const full = join(work, `take${offset}-${n}.mp3`);
    const said = await say(part.join(SEP), spec.voice, { style: spec.voiceStyle, seed,
      previous: texts.slice(0, take[0]).join(' ').slice(-400) || undefined, next: texts.slice(take.at(-1) + 1).join(' ').slice(0, 400) || undefined });
    writeFileSync(full, said.audio);
    const total = probe(full);
    const aligned = unitsFromAlignment(said.alignment, part);
    if (aligned) {
      // tight clips: a little air before the first and after the last word, never past the middle of a pause
      aligned.forEach((u, j) => {
        const lo = j ? (aligned[j - 1].b + u.a) / 2 : 0, hi = j < aligned.length - 1 ? (u.b + aligned[j + 1].a) / 2 : total;
        const from = Math.max(lo, u.a - 0.08), to = Math.min(hi, u.b + 0.25);
        const f = cut(full, from, to, join(work, `v${offset + clips.length}.wav`));
        clips.push({ f, dur: probe(f), words: u.words.map(w => ({ w: w.w, a: w.a - from, b: w.b - from })) });
      });
    } else {
      const inner = part.length === 1 ? [] : cutsFromSilence(full, part.length);
      if (!inner) throw new Error(`Voice: could not split the take into its ${part.length} lines - render again`);
      const cuts = [0, ...inner, total];
      for (let j = 0; j < part.length; j++) { const f = cut(full, cuts[j], j === part.length - 1 ? null : cuts[j + 1], join(work, `v${offset + clips.length}.wav`)); clips.push({ f, dur: probe(f), words: null }); }
    }
  }
  if (clips.length !== units.length || clips.some(c => !(c.dur > 0.1))) throw new Error('Voice: a line came out empty - render again');
  return clips;
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
  const browser = shared || await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(STAGE);
    if (process.env.PERF3D) await page.evaluate(o => { window.__3dopts = o; }, JSON.parse(process.env.PERF3D));
    const units = isVideo(spec.kind) ? await page.evaluate(s => window.units(s), spec) : null;
    const voice = await voiceClips(spec, units, work);
    const info = await page.evaluate(([s, t, c]) => window.setup(s, t, c), [spec, voice?.timing ?? null, stageContext()])
      .catch(e => { throw new Error(e.message.split('\n')[0] + (errs.length ? ' | page: ' + errs.join(' | ') : '')); });
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
      const fps = info.fps || FPS, frames = Math.min(Math.round(info.duration * fps), Number(process.env.BENCH_FRAMES) || Infinity);
      // 3D reels: several pages render frames side by side (frames are independent: render(t) is pure), which
      // keeps the CPU busy while another page is encoding its screenshot. RENDER_PAGES overrides (1 = off).
      const nPages = Math.max(1, Number(process.env.RENDER_PAGES) || 1);   // measured: on 2 cores more pages is slower
      const pages = [page];
      for (let k = 1; k < nPages; k++) {
        const p2 = await browser.newPage({ viewport: { width: info.width, height: info.height }, deviceScaleFactor: 1 });
        await p2.goto(STAGE); await p2.evaluate(([s, t, c]) => window.setup(s, t, c), [spec, voice?.timing ?? null, stageContext()]); pages.push(p2);
      }
      const t0 = Date.now();
      await Promise.all(pages.map(async (pg, k) => {
        for (let i = k; i < frames; i += pages.length) {
          await pg.evaluate(t => window.render(t), i / fps);
          await pg.screenshot({ path: join(work, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
        }
      }));
      if (process.env.BENCH_FRAMES) console.log(`bench: ${frames} frames on ${pages.length} page(s): ${((Date.now() - t0) / frames).toFixed(0)} ms/frame`);
      for (const pg of pages.slice(1)) await pg.close();
      const music = musicFor(spec.music, spec.id);
      if (spec.music && spec.music !== 'none' && !music) result.notes.push(`Nog geen muziek voor "${spec.music}" in de bibliotheek - gemaakt zonder muziek`);
      const sound = mixAudio({ clips: voice?.clips, starts: info.starts, music, duration: info.duration, work });
      const media = join(dir, `${spec.id}.mp4`);
      const audio = sound ? ['-i', sound] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', join(work, 'f%05d.jpg'), ...audio,
        '-map', '0:v', '-map', '1:a', '-t', info.duration.toFixed(3), '-af', 'apad',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps),
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

// WebGL (3D reels) runs in software in headless Chromium; module scripts load from file:// with the first flag.
export const BROWSER_ARGS = ['--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
export const launch = () => pw.chromium.launch({ args: BROWSER_ARGS });

/** Quick look without voice or video: stills of a spec at the given seconds (and its duration). */
export async function renderStills(raw, times, { outDir = join(OUT, project().id), browser: shared } = {}) {
  const spec = await prepare(raw); const dir = join(outDir, spec.id, 'stills'); mkdirSync(dir, { recursive: true });
  const browser = shared || await launch(); const errs = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); else if (process.env.DEBUG3D) console.log('page:', m.text()); });
    await page.goto(STAGE);
    if (process.env.DEBUG3D) await page.evaluate(() => { window.__debug3d = true; });
    if (process.env.PERF3D) await page.evaluate(o => { window.__3dopts = o; }, JSON.parse(process.env.PERF3D));
    const info = await page.evaluate(([s, c]) => window.setup(s, null, c), [spec, stageContext()]).catch(e => { throw new Error(e.message + (errs.length ? ' | ' + errs.join(' | ') : '')); });
    const files = [];
    for (const t of times.length ? times : [0, info.duration / 3, info.duration / 2, info.duration - 1]) {
      const t0 = Date.now(); await page.evaluate(t => { window.render(t); const c = document.querySelector('canvas'); const gl = c?.getContext('webgl2'); if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); }, t); const tr = Date.now() - t0;
      const f = join(dir, `t${t.toFixed(1).padStart(5, '0')}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); files.push({ f, ms: `${tr}+${Date.now() - t0 - tr}` });
    }
    await page.close();
    return { duration: info.duration, fps: info.fps, files, errors: errs };
  } finally { if (!shared) await browser.close(); }
}

// CLI: node engine/render/render.mjs projects/<id>/content/samples/x.json [more.json ...]
// (the project comes from the path, or PROJECT). --frames=1.2,5 also writes stills at those seconds.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await launch();
  const stills = process.argv.find(a => a.startsWith('--stills'));
  if (stills) {
    const times = (stills.split('=')[1] || '').split(',').filter(Boolean).map(Number);
    for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
      const r = await renderStills(JSON.parse(readFileSync(f, 'utf8')), times, { browser });
      console.log(`${f}: ${r.duration.toFixed(1)}s @${r.fps || FPS}fps; ${r.files.map(x => `${x.f.split('/').pop()} (${x.ms} ms)`).join(', ')}${r.errors.length ? '\nerrors: ' + r.errors.join(' | ') : ''}`);
    }
    await browser.close(); process.exit(0);
  }
  for (const f of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
    const r = await renderSpec(JSON.parse(readFileSync(f, 'utf8')), { browser });
    console.log(`${r.id}: ${[r.files.media, ...(r.files.slides?.slice(1) || []), r.files.cover].filter(Boolean).map(x => x.split('/').pop()).join(', ')} ${r.duration ? `(${r.duration.toFixed(1)}s)` : ''} ${r.notes.join('; ')}`);
  }
  await browser.close();
}
