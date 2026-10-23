import { readSecret, saveSecret } from './secrets';

// The studio's side of ElevenLabs: browse Dutch voices, hear a sample, pick the male and female
// voice for the explainer reels (saved as ELEVENLABS_VOICE_MALE / _FEMALE, which the engine reads).
const API = 'https://api.elevenlabs.io/v1';
export const SAMPLE_NL = 'Wist je dat Paulus deze brief schreef vanuit de gevangenis? Toch gaat hij over blijdschap. Lees mee in BijbelStudie.';

export type Voice = { id: string; name: string; gender?: string; accent?: string; age?: string; description?: string; useCase?: string; preview?: string; ownerId?: string; mine: boolean; language?: string };

async function key(project: string) {
  const k = await readSecret(project, 'ELEVENLABS_API_KEY');
  if (!k) throw new Error('Zet eerst je ElevenLabs API key onder Sleutels.');
  return k;
}
async function call(project: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': await key(project), 'content-type': 'application/json', ...(init.headers || {}) }, cache: 'no-store' });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

export async function listVoices(project: string, gender?: string): Promise<{ mine: Voice[]; library: Voice[]; account: { tier?: string; used?: number; limit?: number } }> {
  const q = new URLSearchParams({ language: 'nl', page_size: '40', sort: 'usage_character_count_1y', ...(gender ? { gender } : {}) });
  const [mine, lib, sub] = await Promise.all([
    call(project, '/voices').then(r => r.json()),
    call(project, `/shared-voices?${q}`).then(r => r.json()).catch(() => ({ voices: [] })),
    call(project, '/user/subscription').then(r => r.json()).catch(() => ({})),
  ]);
  // your own voices, without ElevenLabs' English default (premade) voices
  const own = (mine.voices || []).filter((v: any) => v.category !== 'premade' || v.labels?.language === 'nl')
    .map((v: any) => ({ id: v.voice_id, name: v.name, gender: v.labels?.gender, accent: v.labels?.accent, age: v.labels?.age, description: v.labels?.description || v.description, useCase: v.labels?.use_case, preview: v.preview_url, mine: true }));
  const ownIds = new Set(own.map((v: Voice) => v.id)); const ownNames = new Set(own.map((v: Voice) => v.name.split(' (')[0]));
  return {
    mine: own,
    library: (lib.voices || []).filter((v: any) => !ownIds.has(v.voice_id) && !ownNames.has(v.name))
      .map((v: any) => ({ id: v.voice_id, ownerId: v.public_owner_id, name: v.name, gender: v.gender, accent: v.accent, age: v.age, description: v.description, useCase: v.use_case, preview: v.preview_url, language: v.language, mine: false })),
    account: { tier: sub.tier, used: sub.character_count, limit: sub.character_limit },
  };
}

/** Pick a voice for a role. A library voice is first added to the account so the API may use it. */
export async function chooseVoice(project: string, role: 'male' | 'female', voiceId: string, ownerId?: string, name?: string) {
  let id = voiceId;
  if (ownerId) {
    const r = await fetch(`${API}/voices/add/${encodeURIComponent(ownerId)}/${encodeURIComponent(voiceId)}`, {
      method: 'POST', headers: { 'xi-api-key': await key(project), 'content-type': 'application/json' }, body: JSON.stringify({ new_name: `${name || 'Stem'} (BijbelStudie ${role === 'male' ? 'man' : 'vrouw'})` }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.voice_id) id = j.voice_id;
    else if (!/already/i.test(JSON.stringify(j))) throw new Error(`Stem toevoegen mislukt: ${j.detail?.message || j.detail || r.status}`);
  }
  await saveSecret(project, role === 'male' ? 'ELEVENLABS_VOICE_MALE' : 'ELEVENLABS_VOICE_FEMALE', id);
  return id;
}

/** A short Dutch sample in a voice (costs ~120 characters of the monthly quota). */
export async function sample(project: string, voiceId: string) {
  const model = (await readSecret(project, 'ELEVENLABS_MODEL')) || 'eleven_multilingual_v2';
  const r = await call(project, `/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST', body: JSON.stringify({ text: SAMPLE_NL, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      ...(model.startsWith('eleven_multilingual_v2') ? {} : { language_code: 'nl' }) }) });
  return Buffer.from(await r.arrayBuffer());
}
