// YouTube Shorts via the YouTube Data API v3 (free; 100 uploads/day).
// Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN (scope youtube.upload + youtube.readonly)
import { readFileSync, statSync } from 'node:fs';
const env = process.env;
export const youtubeConfigured = () => !!(env.YT_CLIENT_ID && env.YT_CLIENT_SECRET && env.YT_REFRESH_TOKEN);

async function accessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({
    client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!r.ok) throw new Error(`YouTube token: ${j.error_description || j.error}`);
  return j.access_token;
}

export async function publishYouTube(item) {
  const s = item.spec; if (!s.kind.startsWith('reel-')) throw new Error('YouTube only takes videos');
  const token = await accessToken();
  const firstLine = s.caption.split('\n')[0].slice(0, 90);
  const meta = {
    snippet: { title: `${firstLine} #Shorts`.slice(0, 100), description: [s.caption, s.hashtags.join(' ')].join('\n\n'), categoryId: '27', defaultLanguage: 'nl', defaultAudioLanguage: 'nl', tags: s.hashtags.map(h => h.slice(1)) },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false, containsSyntheticMedia: !!item.aiLabel },
  };
  const size = statSync(item.media.file).size;
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(meta) });
  if (!init.ok) throw new Error(`YouTube init ${init.status}: ${await init.text()}`);
  const up = await fetch(init.headers.get('location'), { method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: readFileSync(item.media.file) });
  const j = await up.json(); if (!up.ok) throw new Error(`YouTube upload ${up.status}: ${JSON.stringify(j.error || j)}`);
  const privacy = j.status?.privacyStatus;
  // YouTube can keep an upload private (e.g. account settings or an API-project restriction): flag it
  return { id: j.id, url: `https://youtube.com/shorts/${j.id}`, privacy, needsManual: !!privacy && privacy !== 'public' };
}

export async function youtubeStats(ids) {
  const token = await accessToken();
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json(); if (!r.ok) throw new Error(`YouTube stats: ${JSON.stringify(j.error)}`);
  return Object.fromEntries(j.items.map(v => [v.id, { views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0, comments: +v.statistics.commentCount || 0 }]));
}
