// Instagram (professional account) + Facebook Page via the Graph API. Free, official.
// Env: META_GRAPH_VERSION (default v23.0), IG_USER_ID, FB_PAGE_ID, META_PAGE_TOKEN
// (a long-lived Page access token from your Meta app; it carries instagram_content_publish,
//  instagram_manage_insights, instagram_manage_comments, pages_manage_posts, pages_read_engagement).
const env = process.env;
const V = () => env.META_GRAPH_VERSION || 'v23.0';
const G = path => `https://graph.facebook.com/${V()}/${path}`;
export const metaConfigured = () => !!(env.META_PAGE_TOKEN && env.IG_USER_ID);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(method, path, params = {}) {
  const body = new URLSearchParams({ ...params, access_token: env.META_PAGE_TOKEN });
  const url = method === 'GET' ? `${G(path)}?${body}` : G(path);
  const r = await fetch(url, method === 'GET' ? {} : { method, body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Graph ${path}: ${j.error?.message || r.status}`);
  return j;
}

const fullCaption = s => [s.caption, s.hashtags?.join(' ')].filter(Boolean).join('\n\n');

/** Instagram: image post or reel. Returns { id, url }. */
export async function publishInstagram(item) {
  const s = item.spec; const ig = env.IG_USER_ID;
  const video = s.kind.startsWith('reel-');
  const params = video
    ? { media_type: 'REELS', video_url: item.media.url, cover_url: item.media.coverUrl, caption: fullCaption(s), share_to_feed: 'true' }
    : { image_url: item.media.url, caption: fullCaption(s) };
  if (item.aiLabel) params.is_ai_generated = 'true';     // AI voice / visuals get the platform label
  const { id: container } = await call('POST', `${ig}/media`, params);
  // videos are processed asynchronously; wait until the container is ready (max ~5 min)
  for (let i = 0; video && i < 60; i++) {
    const { status_code } = await call('GET', container, { fields: 'status_code' });
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`IG container ${status_code}`);
    await sleep(5000);
  }
  const { id } = await call('POST', `${ig}/media_publish`, { creation_id: container });
  const { permalink } = await call('GET', id, { fields: 'permalink' });
  return { id, url: permalink };
}

/** Facebook Page: photo post, or a Reel uploaded from the public file URL. */
export async function publishFacebook(item) {
  const s = item.spec; const page = env.FB_PAGE_ID;
  if (!page) throw new Error('FB_PAGE_ID not set');
  if (!s.kind.startsWith('reel-')) {
    const { post_id, id } = await call('POST', `${page}/photos`, { url: item.media.url, caption: fullCaption(s) });
    return { id: post_id || id, url: `https://www.facebook.com/${post_id || id}` };
  }
  const { video_id, upload_url } = await call('POST', `${page}/video_reels`, { upload_phase: 'start' });
  const up = await fetch(upload_url, { method: 'POST', headers: { Authorization: `OAuth ${env.META_PAGE_TOKEN}`, file_url: item.media.url } });
  if (!up.ok) throw new Error(`FB reel upload ${up.status}: ${await up.text()}`);
  await call('POST', `${page}/video_reels`, { upload_phase: 'finish', video_id, video_state: 'PUBLISHED', description: fullCaption(s) });
  return { id: video_id, url: `https://www.facebook.com/reel/${video_id}` };
}

/** Insights for one Instagram media object. */
export async function instagramInsights(mediaId, isReel) {
  const metric = isReel ? 'views,reach,likes,comments,shares,saved,total_interactions' : 'views,reach,likes,comments,shares,saved,total_interactions';
  const { data } = await call('GET', `${mediaId}/insights`, { metric });
  return Object.fromEntries(data.map(m => [m.name, m.values?.[0]?.value ?? m.total_value?.value ?? 0]));
}

export async function instagramAccount() {
  return call('GET', env.IG_USER_ID, { fields: 'followers_count,media_count' });
}

/** Recent comments on a media object (for drafted replies). */
export async function instagramComments(mediaId) {
  const { data } = await call('GET', `${mediaId}/comments`, { fields: 'id,text,username,timestamp' });
  return data;
}

/** Competitor snapshot via Business Discovery (public data of business/creator accounts). */
export async function businessDiscovery(username, limit = 25) {
  const fields = `business_discovery.username(${username}){username,followers_count,media_count,media.limit(${limit}){caption,media_type,media_product_type,like_count,comments_count,view_count,timestamp,permalink}}`;
  const j = await call('GET', env.IG_USER_ID, { fields });
  return j.business_discovery;
}
