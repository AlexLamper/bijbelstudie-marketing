// One-off (or occasional): generate background music beds with ElevenLabs Music into assets/music/,
// shared by every project. Instrumental, calm enough to talk over, ~45 s (the renderer loops them).
// Guards the voice budget: stops before ElevenLabs credits drop under MUSIC_RESERVE (default 15000).
//   node engine/cli/make-music.mjs [mood,mood] [count per mood]      (needs ELEVENLABS_API_KEY; run via music.yml)
import '../env.mjs';
import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { MUSIC_DIR } from '../render/music.mjs';
import { elevenlabsBudget } from '../tts/index.mjs';
import { db, close } from '../db.mjs';

await db();                     // loads keys pasted in the studio (ELEVENLABS_API_KEY)
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY is not set (studio: Instellingen > Sleutels)'); process.exit(1); }

const PROMPTS = {
  calm: 'Gentle, calm instrumental background music for a short Bible study video. Soft felt piano and warm pads, slow tempo around 70 BPM, peaceful, no drums, no vocals, even dynamics without big swells, suitable to speak over.',
  hopeful: 'Hopeful, uplifting instrumental background music. Light piano arpeggios with soft strings and a gentle pulse, around 90 BPM, warm and encouraging, no vocals, even dynamics, suitable to speak over.',
  reflective: 'Reflective ambient instrumental music. Sparse felt piano notes over airy, warm textures, around 65 BPM, contemplative and quiet, no drums, no vocals, suitable to speak over.',
  warm: 'Warm acoustic instrumental. Fingerpicked acoustic guitar with a light shaker and soft bass, around 95 BPM, friendly and positive, no vocals, even dynamics, suitable to speak over.',
  upbeat: 'Light, playful upbeat instrumental for a quiz video. Pizzicato strings, marimba and soft claps, around 110 BPM, fun but not loud, no vocals, even dynamics, suitable to speak over.',
  cinematic: 'Gentle cinematic instrumental. Low strings and piano with slow, soft swells, around 80 BPM, emotional but restrained, no big drums, no vocals, suitable to speak over.',
};
const moods = (process.argv[2] || Object.keys(PROMPTS).join(',')).split(',').filter(m => PROMPTS[m]);
const perMood = Number(process.argv[3] || 1);
const reserve = Number(process.env.MUSIC_RESERVE || 15000);
const SECONDS = 45;

mkdirSync(MUSIC_DIR, { recursive: true });
const manifestFile = join(MUSIC_DIR, 'manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : { note: 'Background music beds (ElevenLabs Music, instrumental). The renderer picks one per mood and loops it.', tracks: [] };

let budget = await elevenlabsBudget(); let lastCost = null;
console.log(budget ? `ElevenLabs credits left: ${budget.left} of ${budget.limit}` : 'ElevenLabs budget unknown (key without user_read permission) - generating anyway');
for (const mood of moods) {
  for (let n = 1; n <= perMood; n++) {
    const file = `${mood}-${n}.mp3`;
    if (manifest.tracks.some(t => t.file === file) && existsSync(join(MUSIC_DIR, file))) { console.log(`skip ${file} (exists)`); continue; }
    if (budget && budget.left - (lastCost || 3000) < reserve) { console.log(`stop: would go under the voice reserve of ${reserve} credits (left ${budget.left})`); break; }
    const r = await fetch('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: PROMPTS[mood], music_length_ms: SECONDS * 1000, force_instrumental: true }),
    });
    if (!r.ok) { console.error(`${file}: ElevenLabs ${r.status} ${(await r.text()).slice(0, 300)}`); if (r.status === 401 || r.status === 403) process.exit(1); continue; }
    const raw = join(MUSIC_DIR, `_raw-${file}`);
    writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
    // even loudness, short fades so the loop point is soft
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', `loudnorm=I=-18:TP=-2:LRA=7,afade=t=in:d=0.4,afade=t=out:st=${SECONDS - 1.2}:d=1.2`, '-ar', '44100', '-b:a', '128k', join(MUSIC_DIR, file)]);
    unlinkSync(raw);
    const after = await elevenlabsBudget();
    if (budget && after) { lastCost = budget.left - after.left; console.log(`${file}: done, cost ${lastCost} credits, ${after.left} left`); } else console.log(`${file}: done`);
    budget = after || budget;
    manifest.tracks = manifest.tracks.filter(t => t.file !== file).concat({ file, mood, seconds: SECONDS, source: 'ElevenLabs Music', prompt: PROMPTS[mood], at: new Date().toISOString().slice(0, 10) });
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  }
}
console.log(`library: ${manifest.tracks.length} tracks (${[...new Set(manifest.tracks.map(t => t.mood))].join(', ')})`);
await close();
