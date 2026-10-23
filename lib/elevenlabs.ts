import { readSecret, saveSecret } from './secrets';
import { getDb } from './mongo';

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

/** A library voice must be added to the account before the API may use it. Returns the usable id. */
async function addToAccount(project: string, voiceId: string, ownerId: string | undefined, label: string) {
  if (!ownerId) return voiceId;
  const r = await fetch(`${API}/voices/add/${encodeURIComponent(ownerId)}/${encodeURIComponent(voiceId)}`, {
    method: 'POST', headers: { 'xi-api-key': await key(project), 'content-type': 'application/json' }, body: JSON.stringify({ new_name: label }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.voice_id) return j.voice_id as string;
  if (/already/i.test(JSON.stringify(j))) return voiceId;
  throw new Error(`Stem toevoegen mislukt: ${j.detail?.message || j.detail || r.status}`);
}

/** Pick a voice for a role (the default man / woman). */
export async function chooseVoice(project: string, role: 'male' | 'female', voiceId: string, ownerId?: string, name?: string) {
  const id = await addToAccount(project, voiceId, ownerId, `${name || 'Stem'} (BijbelStudie ${role === 'male' ? 'man' : 'vrouw'})`);
  await saveSecret(project, role === 'male' ? 'ELEVENLABS_VOICE_MALE' : 'ELEVENLABS_VOICE_FEMALE', id);
  return id;
}

// The voice test set: extra voices the planner rotates through so the experiments can compare them.
// Stored in the project database (settings.voices); the engine reads it when rendering.
export type TestVoice = { key: string; provider: 'elevenlabs'; id: string; name: string; gender?: string };
export async function testSet(project: string): Promise<TestVoice[]> {
  return ((await (await getDb(project)).collection('settings').findOne({ _id: 'voices' as any }))?.list || []) as TestVoice[];
}
export async function addTestVoice(project: string, voiceId: string, ownerId: string | undefined, name: string, gender?: string) {
  const list = await testSet(project);
  const id = await addToAccount(project, voiceId, ownerId, `${name} (BijbelStudie test)`);
  if (list.some(v => v.id === id)) return list;
  const base = (name.split(/[\s-]/)[0] || 'stem').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') || 'stem';
  let k = base, n = 2; while (['male', 'female', 'none', 'geen'].includes(k) || list.some(v => v.key === k)) k = `${base}${n++}`;
  const next = [...list, { key: k, provider: 'elevenlabs' as const, id, name: name.split(' - ')[0].slice(0, 40), gender }];
  await (await getDb(project)).collection('settings').updateOne({ _id: 'voices' as any }, { $set: { list: next, updatedAt: new Date() } }, { upsert: true });
  return next;
}
export async function removeTestVoice(project: string, keyName: string) {
  const next = (await testSet(project)).filter(v => v.key !== keyName);
  await (await getDb(project)).collection('settings').updateOne({ _id: 'voices' as any }, { $set: { list: next, updatedAt: new Date() } }, { upsert: true });
  return next;
}

/** A short Dutch sample in a voice (costs ~120 characters of the monthly quota). */
export async function sample(project: string, voiceId: string) {
  const model = (await readSecret(project, 'ELEVENLABS_MODEL')) || 'eleven_multilingual_v2';
  const r = await call(project, `/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: 'POST', body: JSON.stringify({ text: SAMPLE_NL, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
      ...(model.startsWith('eleven_multilingual_v2') ? {} : { language_code: 'nl' }) }) });
  return Buffer.from(await r.arrayBuffer());
}
