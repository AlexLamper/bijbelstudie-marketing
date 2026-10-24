// What the engine can use right now: the voice test set (studio: Instellingen > Stemmen) and the
// music moods in assets/music. Shared by the render job, the stats job and the planner context.
import { musicLibrary } from './render/music.mjs';
import { scoreboard, trials, catalogue } from './experiments.mjs';
import { project } from './project.mjs';

/** Voice test set from Mongo settings.voices: [{ key, provider, id, name, gender }]. Also made available to tts. */
export async function loadVoices(d) {
  const doc = await d.collection('settings').findOne({ _id: 'voices' });
  const list = (doc?.list || []).filter(v => v.key && v.id);
  globalThis.__voiceLibrary = list;
  return list;
}

/** Voice keys a spec may use: male/female (when set) + the test set. */
export function voiceKeys(list) {
  const allowed = project().voicesAllowed;   // project.json: limit the voices the planner may use
  return allVoiceKeys(list).filter(k => !allowed || allowed.includes(k));
}
function allVoiceKeys(list) {
  const keys = [];
  if (process.env.ELEVENLABS_VOICE_MALE || process.env.GOOGLE_TTS_API_KEY) keys.push('male');
  if (process.env.ELEVENLABS_VOICE_FEMALE || process.env.GOOGLE_TTS_API_KEY) keys.push('female');
  for (const v of list) if (!keys.includes(v.key) && v.id !== process.env.ELEVENLABS_VOICE_MALE && v.id !== process.env.ELEVENLABS_VOICE_FEMALE) keys.push(v.key);
  return keys;
}
export const musicMoods = () => [...new Set(musicLibrary().map(t => t.mood))].filter(m => !project().musicMoods || project().musicMoods.includes(m));

/** Recompute the scoreboard from the last 8 weeks of published items and store it for the studio. */
export async function updateBoard(d, { seed } = {}) {
  const since = new Date(Date.now() - 56 * 864e5);
  const items = await d.collection('items').find({ publishedAt: { $gte: since } }).toArray();
  const voices = voiceKeys(await loadVoices(d));
  const rows = trials(items);
  const P = project();
  const board = scoreboard(rows, catalogue({ voices, moods: musicMoods(), voiceStyles: P.voiceStylesAllowed, formats: P.formatsAllowed, postFormats: P.postFormatsAllowed, styles: P.stylesAllowed, styles3d: P.style3dAllowed, narratorOnly: P.narratorOnly }),
    { seed: seed ?? Math.floor(Date.now() / 864e5), priors: P.experimentPriors });
  const doc = { board, trials: rows.length, items: new Set(rows.map(r => r.id)).size, voices, moods: musicMoods(), at: new Date() };
  await d.collection('experiments').updateOne({ _id: 'board' }, { $set: doc }, { upsert: true });
  return { ...doc, rows };
}
