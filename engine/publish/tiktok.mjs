// TikTok via the official Content Posting API (free). Until TikTok audits the app, posts are
// visible only to you (SELF_ONLY) - the publisher then marks them "needs manual post".
// Bridge: set UPLOADPOST_API_KEY to post through Upload-Post's audited app instead.
// Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET; the rotating tokens live in Mongo (tokens.tiktok),
// seeded once with TIKTOK_REFRESH_TOKEN.
import { readFileSync, statSync } from 'node:fs';
import { getToken, saveToken } from '../db.mjs';
const env = process.env;
const API = 'https://open.tiktokapis.com/v2';
export const tiktokConfigured = () => !!(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && (env.TIKTOK_REFRESH_TOKEN || env.TIKTOK_LINKED));
export const uploadPostConfigured = () => !!(env.UPLOADPOST_API_KEY && env.UPLOADPOST_USER);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function accessToken() {
  const saved = await getToken('tiktok');   // { accessToken, refreshToken, expiresAt } from the studio, or the legacy snake_case shape
  const access = saved?.accessToken || saved?.access_token, expires = saved?.expiresAt || saved?.expires_at;
  if (access && expires > Date.now() + 60_000) return access;
  const refresh = saved?.refreshToken || saved?.refresh_token || env.TIKTOK_REFRESH_TOKEN;
  if (!refresh) throw new Error('TikTok is not linked: Instellingen > TikTok > Koppel in the studio');
  const r = await fetch(`${API}/oauth/token/`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env.TIKTOK_CLIENT_KEY, client_secret: env.TIKTOK_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refresh }) });
  const j = await r.json(); if (!r.ok || j.error) throw new Error(`TikTok token: ${j.error_description || j.error}`);
  await saveToken('tiktok', { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + j.expires_in * 1000, refreshExpiresAt: Date.now() + j.refresh_expires_in * 1000 });
  return j.access_token;
}

async function api(path, token, body) {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body || {}) });
  const j = await r.json(); if (j.error?.code && j.error.code !== 'ok') throw new Error(`TikTok ${path}: ${j.error.code} ${j.error.message}`);
  return j.data;
}

export async function publishTikTok(item) {
  if (uploadPostConfigured()) return publishViaUploadPost(item, 'tiktok');
  const s = item.spec; const token = await accessToken();
  const creator = await api('/post/publish/creator_info/query/', token);
  const privacy = creator.privacy_level_options.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : 'SELF_ONLY';
  const size = statSync(item.media.file).size;
  const init = await api('/post/publish/video/init/', token, {
    post_info: { title: [s.caption, s.hashtags.join(' ')].join(' ').slice(0, 2200), privacy_level: privacy,
      disable_duet: false, disable_comment: false, disable_stitch: false, is_aigc: !!item.aiLabel },
    source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
  });
  const up = await fetch(init.upload_url, { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size), 'Content-Range': `bytes 0-${size - 1}/${size}` }, body: readFileSync(item.media.file) });
  if (!up.ok) throw new Error(`TikTok upload ${up.status}: ${await up.text()}`);
  for (let i = 0; i < 40; i++) {
    const st = await api('/post/publish/status/fetch/', token, { publish_id: init.publish_id });
    if (st.status === 'PUBLISH_COMPLETE') return { id: st.publicaly_available_post_id?.[0] || init.publish_id, privacy, needsManual: privacy !== 'PUBLIC_TO_EVERYONE' };
    if (st.status === 'FAILED') throw new Error(`TikTok publish failed: ${st.fail_reason}`);
    await sleep(5000);
  }
  return { id: init.publish_id, privacy, pending: true };
}

/** Upload-Post bridge (paid, ~$16-24/mo): its own audited TikTok/YouTube apps post publicly. */
export async function publishViaUploadPost(item, platform) {
  const s = item.spec; const form = new FormData();
  form.append('user', env.UPLOADPOST_USER);
  form.append('platform[]', platform);
  form.append('title', [s.caption, s.hashtags.join(' ')].join(' ').slice(0, 2200));
  form.append('video', new Blob([readFileSync(item.media.file)], { type: 'video/mp4' }), `${s.id}.mp4`);
  const r = await fetch('https://api.upload-post.com/api/upload', { method: 'POST', headers: { Authorization: `Apikey ${env.UPLOADPOST_API_KEY}` }, body: form });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.success === false) throw new Error(`Upload-Post ${r.status}: ${JSON.stringify(j)}`);
  return { id: j.request_id || j.id || 'upload-post', via: 'upload-post' };
}
