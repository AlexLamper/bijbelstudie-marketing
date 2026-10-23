import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Tokens and app secrets are stored encrypted (AES-256-GCM). The key is derived from ENGINE_KEY,
// which both the studio (Vercel) and the engine (GitHub Actions) have; the engine copy of this
// code is engine/crypto.mjs. A leaked database alone gives no usable tokens.
// Rotating ENGINE_KEY means reconnecting the accounts on the Instellingen page.

const key = () => {
  if (!process.env.ENGINE_KEY) throw new Error('ENGINE_KEY is not set');
  return createHash('sha256').update(`connections:${process.env.ENGINE_KEY}`).digest();
};

export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export function open<T = any>(sealed: string): T {
  const buf = Buffer.from(sealed, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
}
