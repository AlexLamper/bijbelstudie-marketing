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

/** Instagram: image post, carousel or reel. Returns { id, url }. */
export async function publishInstagram(item) {
  const s = item.spec; const ig = env.IG_USER_ID;
  if (s.kind === 'carousel') {
    const children = [];
    for (const url of item.media.slides) children.push((await call('POST', `${ig}/media`, { image_url: url, is_carousel_item: 'true' })).id);
    const { id: container } = await call('POST', `${ig}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: fullCaption(s) });
    for (let i = 0; i < 24; i++) { const { status_code } = await call('GET', container, { fields: 'status_code' }); if (status_code === 'FINISHED') break; if (status_code === 'ERROR') throw new Error('IG carousel container ERROR'); await sleep(5000); }
    const { id } = await call('POST', `${ig}/media_publish`, { creation_id: container });
    const { permalink } = await call('GET', id, { fields: 'permalink' });
    return { id, url: permalink };
  }
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
  if (s.kind === 'carousel') {   // multi-photo post: upload unpublished photos, then one post with all of them
    const params = { message: fullCaption(s) };
    for (const [i, url] of item.media.slides.entries()) params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: (await call('POST', `${page}/photos`, { url, published: 'false' })).id });
    const { id } = await call('POST', `${page}/feed`, params);
    return { id, url: `https://www.facebook.com/${id}` };
  }
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

/** Insights for one Instagram media object. Reels also get watch time (ms) when Meta provides it. */
export async function instagramInsights(mediaId, isReel) {
  const base = 'views,reach,likes,comments,shares,saved,total_interactions';
  let data;
  try { ({ data } = await call('GET', `${mediaId}/insights`, { metric: isReel ? `${base},ig_reels_avg_watch_time,ig_reels_video_view_total_time` : base })); }
  catch { ({ data } = await call('GET', `${mediaId}/insights`, { metric: base })); }
  const m = Object.fromEntries(data.map(x => [x.name, x.values?.[0]?.value ?? x.total_value?.value ?? 0]));
  if (m.ig_reels_avg_watch_time != null) { m.avgWatchMs = m.ig_reels_avg_watch_time; delete m.ig_reels_avg_watch_time; }
  if (m.ig_reels_video_view_total_time != null) { m.totalWatchMs = m.ig_reels_video_view_total_time; delete m.ig_reels_video_view_total_time; }
  return m;
}

/** Numbers for one Facebook post or reel: { views, likes, comments, shares }. Metric names differ per
 *  post type and Graph version, so each is tried and the ones Meta answers are kept. */
export async function facebookInsights(result, isReel) {
  const id = result.id; const m = {};
  const tryMetric = async (path, names) => { for (const n of names) { try { const { data } = await call('GET', path, { metric: n }); const v = data?.[0]?.values?.[0]?.value ?? data?.[0]?.total_value?.value; if (v != null) return typeof v === 'object' ? Object.values(v).reduce((a, b) => a + b, 0) : v; } catch {} } return null; };
  if (isReel) {
    m.views = await tryMetric(`${id}/video_insights`, ['blue_reels_play_count', 'fb_reels_total_plays', 'total_video_views']);
    const avg = await tryMetric(`${id}/video_insights`, ['post_video_avg_time_watched']); if (avg != null) m.avgWatchMs = avg;
    try { const j = await call('GET', id, { fields: 'likes.summary(true).limit(0),comments.summary(true).limit(0)' }); m.likes = j.likes?.summary?.total_count ?? 0; m.comments = j.comments?.summary?.total_count ?? 0; } catch {}
  } else {
    m.views = await tryMetric(`${id}/insights`, ['post_media_view', 'post_impressions_unique', 'post_impressions']);
    try { const j = await call('GET', id, { fields: 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares' }); m.likes = j.reactions?.summary?.total_count ?? 0; m.comments = j.comments?.summary?.total_count ?? 0; m.shares = j.shares?.count ?? 0; } catch {}
  }
  if (m.views == null) delete m.views;
  return m;
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
