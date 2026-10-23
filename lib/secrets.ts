import { getDb, getSharedDb } from './mongo';
import { open, seal } from './crypto';

// Keys Alex can paste in the studio instead of in GitHub's secret settings. Stored sealed in Mongo;
// the engine loads them at the start of every job (engine/db.mjs), the planner workflow reads
// CLAUDE_CODE_OAUTH_TOKEN through engine/cli/studio-secret.mjs. GitHub secrets with the same
// name still win. Values are never shown again after saving.

export type SecretDef = { name: string; label: string; help: string; scope: 'shared' | 'project'; secret: boolean; optional?: boolean; pattern?: RegExp };

export const SECRET_DEFS: SecretDef[] = [
  { name: 'CLAUDE_CODE_OAUTH_TOKEN', label: 'Claude (weekplanner)', scope: 'shared', secret: true, pattern: /^sk-ant-[\w-]{20,}$/,
    help: 'Op je computer: `claude setup-token`, log in met je Claude-account en plak de token hier. Gebruikt je Claude-abonnement.' },
  { name: 'GITHUB_DISPATCH_TOKEN', label: 'GitHub-token (tijdschema)', scope: 'shared', secret: true, pattern: /^(github_pat_|ghp_)\w{20,}$/,
    help: 'Laat de studio de engine op tijd starten (GitHub-schema\'s blijven soms uit). GitHub > Settings > Developer settings > Fine-grained tokens: alleen deze repository, Actions: Read and write.' },
  { name: 'ELEVENLABS_API_KEY', label: 'ElevenLabs API key', scope: 'shared', secret: true, optional: true,
    help: 'Stem voor uitleg-reels. elevenlabs.io > Profile > API keys.' },
  { name: 'ELEVENLABS_VOICE_MALE', label: 'ElevenLabs stem (man)', scope: 'shared', secret: false, optional: true, pattern: /^\w{10,40}$/, help: 'Voice ID uit de Voice Library.' },
  { name: 'ELEVENLABS_VOICE_FEMALE', label: 'ElevenLabs stem (vrouw)', scope: 'shared', secret: false, optional: true, pattern: /^\w{10,40}$/, help: 'Voice ID uit de Voice Library.' },
  { name: 'ELEVENLABS_MODEL', label: 'ElevenLabs model', scope: 'shared', secret: false, optional: true, pattern: /^eleven_[a-z0-9_]+$/,
    help: 'Leeg = eleven_multilingual_v2 (stabiel, goed Nederlands). Alternatief: eleven_v3 (expressiever).' },
  { name: 'GOOGLE_TTS_API_KEY', label: 'Google Text-to-Speech key', scope: 'shared', secret: true, optional: true,
    help: 'Gratis alternatief voor ElevenLabs (1 miljoen tekens per maand). Google Cloud > Credentials > API key met Text-to-Speech.' },
  { name: 'RESEND_API_KEY', label: 'Resend API key', scope: 'shared', secret: true, optional: true, help: 'Meldingen per e-mail in plaats van GitHub-issues.' },
  { name: 'NOTIFY_TO', label: 'Meldingen naar e-mailadres', scope: 'shared', secret: false, optional: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, help: 'Alleen nodig met Resend.' },
  { name: 'PLATFORM_MONGODB_URI', label: 'Database van het product (alleen lezen)', scope: 'project', secret: true, optional: true, pattern: /^mongodb(\+srv)?:\/\//,
    help: 'Om nieuwe gebruikers per dag te tellen. Maak in Atlas een gebruiker met alleen leesrechten op de productdatabase.' },
  { name: 'PLATFORM_MONGODB_DB', label: 'Naam van die database', scope: 'project', secret: false, optional: true, pattern: /^[\w-]{1,64}$/, help: 'Leeg = de database uit de connection string.' },
];
export const secretDef = (name: string) => SECRET_DEFS.find(d => d.name === name);

const collection = async (def: SecretDef, project: string) =>
  (def.scope === 'shared' ? await getSharedDb() : await getDb(project)).collection('secrets');

export async function listSecrets(project: string) {
  const [shared, own] = await Promise.all([
    (await getSharedDb()).collection('secrets').find({}, { projection: { hint: 1, updatedAt: 1 } }).toArray(),
    (await getDb(project)).collection('secrets').find({}, { projection: { hint: 1, updatedAt: 1 } }).toArray(),
  ]);
  const stored = new Map([...shared, ...own].map(d => [String(d._id), d]));
  return SECRET_DEFS.map(def => {
    const d = stored.get(def.name);
    return { ...def, pattern: undefined, inStudio: !!d, hint: d?.hint as string | undefined, updatedAt: d?.updatedAt as Date | undefined };
  });
}

export async function saveSecret(project: string, name: string, value: string) {
  const def = secretDef(name);
  if (!def) throw new Error('Onbekende sleutel');
  const v = value.trim();
  if (!v || v.length > 4000) throw new Error('Leeg of te lang');
  if (def.pattern && !def.pattern.test(v)) throw new Error('Dit ziet er niet uit als een geldige waarde voor ' + def.label);
  const hint = def.secret ? `...${v.slice(-4)}` : v;
  await (await collection(def, project)).updateOne({ _id: name as any }, { $set: { value: seal(v), hint, updatedAt: new Date() } }, { upsert: true });
}

export async function deleteSecret(project: string, name: string) {
  const def = secretDef(name);
  if (!def) throw new Error('Onbekende sleutel');
  await (await collection(def, project)).deleteOne({ _id: name as any });
}

/** A key's value for use inside the studio itself (env wins, else the sealed copy). Never send it to the browser. */
export async function readSecret(project: string, name: string): Promise<string | null> {
  if (process.env[name]) return process.env[name]!;
  const def = secretDef(name); if (!def) return null;
  const d = await (await collection(def, project)).findOne({ _id: name as any });
  if (!d) return null;
  try { return open<string>(d.value); } catch { return null; }
}
