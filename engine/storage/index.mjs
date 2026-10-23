// Where rendered media lives. Platforms pull files from a public URL, so storage must be public.
// Default: Vercel Blob (BLOB_READ_WRITE_TOKEN, created by the Vercel project). Fallback: Cloudflare R2.
const env = process.env;

export const storageProvider = () => (env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : (env.R2_ACCOUNT_ID ? 'r2' : null));
export const storageConfigured = () => !!storageProvider();

/** Upload a local file under key; returns its public URL. */
export async function upload(file, key) {
  if (storageProvider() === 'vercel-blob') {
    const { put } = await import('@vercel/blob');
    const { readFileSync } = await import('node:fs');
    const type = file.endsWith('.mp4') ? 'video/mp4' : file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const blob = await put(`media/${key}`, readFileSync(file), { access: 'public', contentType: type, addRandomSuffix: false, token: env.BLOB_READ_WRITE_TOKEN, cacheControlMaxAge: 31536000 });
    return blob.url;
  }
  if (storageProvider() === 'r2') return (await import('./r2.mjs')).upload(file, key);
  throw new Error('No media storage configured: set BLOB_READ_WRITE_TOKEN (Vercel Blob) or the R2_* variables');
}

/** Remove media that is no longer needed (published long ago, or rejected). */
export async function remove(urls) {
  urls = urls.filter(Boolean);
  if (!urls.length || storageProvider() !== 'vercel-blob') return;
  const { del } = await import('@vercel/blob');
  await del(urls, { token: env.BLOB_READ_WRITE_TOKEN });
}
