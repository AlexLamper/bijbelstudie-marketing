// Cloudflare R2 (S3 API) upload with a hand-rolled SigV4 signature - no SDK needed.
// Media must sit on a public URL: Instagram, Facebook and TikTok pull files from there.
// Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL (e.g. https://media.bijbelstudie.io)
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const env = process.env;
const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.m4a': 'audio/mp4', '.json': 'application/json' };
const sha = d => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();

export const storageConfigured = () => !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_PUBLIC_URL);

/** Upload a local file to key; returns its public URL. */
export async function upload(file, key) {
  if (!storageConfigured()) throw new Error('R2 not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL)');
  const body = readFileSync(file);
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const path = `/${env.R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const hash = sha(body);
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { host, 'content-type': type, 'x-amz-content-sha256': hash, 'x-amz-date': amzDate };
  const signed = Object.keys(headers).sort();
  const canonical = ['PUT', path, '', ...signed.map(h => `${h}:${headers[h]}`), '', signed.join(';'), hash].join('\n');
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha(canonical)].join('\n');
  const kSign = ['auto', 's3', 'aws4_request'].reduce((k, d) => hmac(k, d), hmac(`AWS4${env.R2_SECRET_ACCESS_KEY}`, day));
  const signature = createHmac('sha256', kSign).update(toSign).digest('hex');
  const auth = `AWS4-HMAC-SHA256 Credential=${env.R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}`;
  const r = await fetch(`https://${host}${path}`, { method: 'PUT', headers: { ...headers, authorization: auth }, body });
  if (!r.ok) throw new Error(`R2 upload ${r.status}: ${await r.text()}`);
  return `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
}
