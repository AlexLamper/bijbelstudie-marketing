// Background music: a small library of beds per mood in assets/music/ (generated once with ElevenLabs
// Music by engine/cli/make-music.mjs, see .github/workflows/music.yml). manifest.json lists them.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SHARED_ASSETS } from '../project.mjs';

export const MUSIC_DIR = join(SHARED_ASSETS, 'music');
const MANIFEST = join(MUSIC_DIR, 'manifest.json');
export const musicLibrary = () => existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')).tracks || [] : [];

/** A track for a mood, picked by a stable hash of the item id (so a re-render keeps its music). */
export function musicFor(mood, seed = '') {
  if (!mood || mood === 'none') return null;
  const tracks = musicLibrary().filter(t => t.mood === mood && existsSync(join(MUSIC_DIR, t.file)));
  if (!tracks.length) return null;
  let h = 0; for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return join(MUSIC_DIR, tracks[h % tracks.length].file);
}
