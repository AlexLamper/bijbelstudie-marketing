// Voice for explainer reels. Google Cloud TTS (free tier: 1M chars/month on Chirp 3 HD,
// 4M on WaveNet) is the default; ElevenLabs is used when its key is set (better voice, ~$6/month).
// Voice names live in env so they can be swapped without code changes.
const env = process.env;

export const ttsProvider = () => (env.ELEVENLABS_API_KEY ? 'elevenlabs' : env.GOOGLE_TTS_API_KEY ? 'google' : null);
export const ttsConfigured = () => !!ttsProvider();

const GOOGLE_VOICES = {
  male: env.GOOGLE_TTS_VOICE_MALE || 'nl-NL-Chirp3-HD-Charon',
  female: env.GOOGLE_TTS_VOICE_FEMALE || 'nl-NL-Chirp3-HD-Aoede',
};

async function google(text, voice) {
  const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.GOOGLE_TTS_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'nl-NL', name: GOOGLE_VOICES[voice] },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, sampleRateHertz: 44100 },
    }),
  });
  if (!r.ok) throw new Error(`Google TTS ${r.status}: ${await r.text()}`);
  return Buffer.from((await r.json()).audioContent, 'base64');
}

// ElevenLabs: model from ELEVENLABS_MODEL (default eleven_multilingual_v2, reads Dutch well).
// language_code is only sent to models that support it (not multilingual_v2). previous/next text
// keep the intonation flowing between the separately generated lines of one reel.
async function elevenlabs(text, voice, { previous, next } = {}) {
  const id = voice === 'male' ? env.ELEVENLABS_VOICE_MALE : env.ELEVENLABS_VOICE_FEMALE;
  if (!id) throw new Error(`Set ELEVENLABS_VOICE_${voice.toUpperCase()} to a voice id (studio: Instellingen > Stemmen)`);
  const model = env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
  const body = { text, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } };
  if (!model.startsWith('eleven_multilingual_v2')) body.language_code = 'nl';
  if (previous) body.previous_text = previous;
  if (next) body.next_text = next;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function synthesize(text, voice = 'female', context = {}) {
  const p = ttsProvider();
  if (p === 'elevenlabs') return elevenlabs(text, voice, context);
  if (p === 'google') return google(text, voice);
  throw new Error('No TTS configured: set GOOGLE_TTS_API_KEY or ELEVENLABS_API_KEY');
}
