// Same as lib/crypto.ts in the studio: AES-256-GCM with a key derived from ENGINE_KEY.
// Used for OAuth tokens and app secrets stored in Mongo.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const key = () => {
  if (!process.env.ENGINE_KEY) throw new Error('ENGINE_KEY is not set');
  return createHash('sha256').update(`connections:${process.env.ENGINE_KEY}`).digest();
};

export function seal(value) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export function open(sealed) {
  const buf = Buffer.from(sealed, 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8'));
}
