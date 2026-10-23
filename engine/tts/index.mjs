// Voices for reels. ElevenLabs when its key is set (best Dutch, word timestamps); Google Cloud TTS
// (free tier) as the alternative. A spec names a voice by key:
//   "male" / "female"  - the two voices chosen in the studio (ELEVENLABS_VOICE_MALE/FEMALE)
//   any other key      - a voice from the test set (studio: Instellingen > Stemmen), loaded into
//                        globalThis.__voiceLibrary by the render job ([{ key, provider, id, name, gender }])
// voiceStyle "rustig" = steady narrator (eleven_multilingual_v2), "levendig" = expressive (eleven_v3).
const env = process.env;

export const ttsProvider = () => (env.ELEVENLABS_API_KEY ? 'elevenlabs' : env.GOOGLE_TTS_API_KEY ? 'google' : null);
export const ttsConfigured = () => !!ttsProvider();

const GOOGLE_VOICES = {
  male: env.GOOGLE_TTS_VOICE_MALE || 'nl-NL-Chirp3-HD-Charon',
  female: env.GOOGLE_TTS_VOICE_FEMALE || 'nl-NL-Chirp3-HD-Aoede',
};

export const voiceLibrary = () => globalThis.__voiceLibrary || (env.VOICE_LIBRARY ? JSON.parse(env.VOICE_LIBRARY) : []);

/** key -> { provider, id, name } */
export function resolveVoice(key = 'female') {
  if (key === 'male' || key === 'female') {
    const id = env[`ELEVENLABS_VOICE_${key.toUpperCase()}`];
    if (env.ELEVENLABS_API_KEY && id) return { provider: 'elevenlabs', id, name: key };
    if (env.GOOGLE_TTS_API_KEY) return { provider: 'google', id: GOOGLE_VOICES[key], name: key };
    if (env.ELEVENLABS_API_KEY) throw new Error(`Set ELEVENLABS_VOICE_${key.toUpperCase()} to a voice id (studio: Instellingen > Stemmen)`);
    throw new Error('No TTS configured: set ELEVENLABS_API_KEY or GOOGLE_TTS_API_KEY');
  }
  const v = voiceLibrary().find(v => v.key === key);
  if (!v) throw new Error(`Unknown voice "${key}" - add it to the test set in the studio (Instellingen > Stemmen) or use male/female`);
  return { provider: v.provider || 'elevenlabs', id: v.id, name: v.name || key };
}

async function google(text, voiceName) {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: { text }, voice: { languageCode: 'nl-NL', name: voiceName }, audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, sampleRateHertz: 44100 } }),
  });
  if (!r.ok) throw new Error(`Google TTS ${r.status}: ${await r.text()}`);
  return { audio: Buffer.from((await r.json()).audioContent, 'base64'), words: null };
}

/** Character alignment -> words with start/end seconds. */
export function wordsFrom(al) {
  if (!al?.characters?.length) return null;
  const words = []; let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', a: al.character_start_times_seconds[i], b: al.character_end_times_seconds[i] };
    cur.w += ch; cur.b = al.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  return words;
}

const STYLES = {
  rustig: { model: () => env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } },
  levendig: { model: () => 'eleven_v3', settings: { stability: 0.5, similarity_boost: 0.8, use_speaker_boost: true } },
};

// language_code only for models that take it (not multilingual_v2); previous/next text keep the
// intonation flowing between separately generated lines (not supported by eleven_v3).
async function elevenlabs(text, voiceId, { style = 'rustig', previous, next, timestamps = true } = {}) {
  const S = STYLES[style] || STYLES.rustig; const model = S.model();
  const body = { text, model_id: model, voice_settings: S.settings };
  if (!model.startsWith('eleven_multilingual_v2')) body.language_code = 'nl';
  if (!model.startsWith('eleven_v3')) { if (previous) body.previous_text = previous; if (next) body.next_text = next; }
  const path = timestamps ? `${voiceId}/with-timestamps` : voiceId;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${path}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) {
    const msg = (await r.text()).slice(0, 300);
    if (timestamps && r.status !== 401 && r.status !== 429) return elevenlabs(text, voiceId, { style, previous, next, timestamps: false });   // model without alignment
    throw new Error(`ElevenLabs ${r.status}: ${msg}`);
  }
  if (!timestamps) return { audio: Buffer.from(await r.arrayBuffer()), words: null };
  const j = await r.json();
  return { audio: Buffer.from(j.audio_base64, 'base64'), words: wordsFrom(j.alignment) };
}

/** Speak text with a voice key. Returns { audio: Buffer (mp3), words: [{ w, a, b }] | null }. */
export async function synthesize(text, voice = 'female', opts = {}) {
  const v = resolveVoice(voice);
  if (v.provider === 'google') return google(text, v.id);
  return elevenlabs(text, v.id, opts);
}

/** This month's ElevenLabs characters: { used, limit, left, resetsAt } or null (no key / no permission). */
export async function elevenlabsBudget() {
  if (!env.ELEVENLABS_API_KEY) return null;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': env.ELEVENLABS_API_KEY } });
    if (!r.ok) return null;
    const j = await r.json();
    return { used: j.character_count, limit: j.character_limit, left: j.character_limit - j.character_count, resetsAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : null };
  } catch { return null; }
}
