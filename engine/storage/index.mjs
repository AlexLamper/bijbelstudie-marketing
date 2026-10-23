// Where rendered media lives. Platforms pull files from a public URL, so storage must be public.
// 1. BLOB_READ_WRITE_TOKEN set  -> Vercel Blob directly
// 2. STUDIO_URL + ENGINE_KEY    -> Vercel Blob via a short-lived upload token from the studio (default)
// 3. R2_* set                   -> Cloudflare R2
const env = process.env;

export const storageProvider = () => env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : (env.STUDIO_URL && env.ENGINE_KEY) ? 'vercel-blob-via-studio' : env.R2_ACCOUNT_ID ? 'r2' : null;
export const storageConfigured = () => !!storageProvider();

async function studio(path, body) {
  const r = await fetch(`${env.STUDIO_URL.replace(/\/$/, '')}/api/engine/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-engine-key': env.ENGINE_KEY }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`studio ${path} ${r.status}: ${j.error || 'no response'}`);
  return j;
}

/** Upload a local file under key; returns its public URL. */
export async function upload(file, key) {
  const p = storageProvider();
  if (p === 'vercel-blob' || p === 'vercel-blob-via-studio') {
    const { put } = await import('@vercel/blob');
    const { readFileSync } = await import('node:fs');
    const pathname = `media/${key}`;
    const contentType = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const token = p === 'vercel-blob' ? env.BLOB_READ_WRITE_TOKEN : (await studio('blob-token', { pathname })).token;
    const blob = await put(pathname, readFileSync(file), { access: 'public', contentType, addRandomSuffix: false, token });
    return blob.url;
  }
  if (p === 'r2') return (await import('./r2.mjs')).upload(file, key);
  throw new Error('No media storage configured: STUDIO_URL + ENGINE_KEY, BLOB_READ_WRITE_TOKEN, or R2_*');
}

/** Remove media that is no longer needed (published long ago, or rejected). */
export async function remove(urls) {
  urls = urls.filter(Boolean);
  if (!urls.length) return;
  const p = storageProvider();
  if (p === 'vercel-blob') { const { del } = await import('@vercel/blob'); await del(urls, { token: env.BLOB_READ_WRITE_TOKEN }); }
  else if (p === 'vercel-blob-via-studio') await studio('blob-delete', { urls });
}
