// Diagnoses the Instagram/Facebook link without posting anything (run via maintenance.yml): where the
// Page token comes from, what Meta says about it (debug_token), and whether the Page and the Instagram
// account can be read with it. Prints no secrets. --write-test also checks that it may write (see below).
import '../env.mjs';
import { db, close } from '../db.mjs';
import { applyConnections } from '../connections.mjs';
import { project } from '../project.mjs';

const env = process.env; const P = project().id;
const fromKey = !!env.META_PAGE_TOKEN;   // a GitHub secret or a studio key wins over the linked account
const linked = await applyConnections();
const tok = env.META_PAGE_TOKEN;
console.log(`[${P}] token from: ${fromKey ? 'META_PAGE_TOKEN (GitHub secret or studio key - overrides the linked account)' : linked.meta ? `the linked account "${linked.meta}"` : 'nowhere'}; FB_PAGE_ID ${env.FB_PAGE_ID || '-'}, IG_USER_ID ${env.IG_USER_ID || '-'}`);
if (!tok) { await tiktokPart(); await close(); process.exit(0); }
const V = env.META_GRAPH_VERSION || 'v23.0';
const get = async (path, params = {}) => {
  const u = new URL(`https://graph.facebook.com/${V}/${path}`);
  for (const [k, v] of Object.entries({ ...params, access_token: tok })) u.searchParams.set(k, v);
  try { return await (await fetch(u)).json(); } catch (e) { return { error: { message: e.message } }; }
};
const show = (label, j) => console.log(`[${P}] ${label}: ${j.error ? `ERROR ${j.error.code ?? ''}/${j.error.error_subcode ?? ''} ${j.error.type ?? ''}: ${j.error.message}` : JSON.stringify(j).slice(0, 400)}`);
const dbg = await get('debug_token', { input_token: tok });
if (dbg.data) { const d = dbg.data; show('debug_token', { app_id: d.app_id, application: d.application, type: d.type, is_valid: d.is_valid, user_id: d.user_id, profile_id: d.profile_id, expires_at: d.expires_at, data_access_expires_at: d.data_access_expires_at, scopes: d.scopes, error: d.error }); }
else show('debug_token', dbg);
show('me', await get('me', { fields: 'id,name' }));
if (env.FB_PAGE_ID) show('page', await get(env.FB_PAGE_ID, { fields: 'id,name,tasks' }));
if (env.IG_USER_ID) show('instagram', await get(env.IG_USER_ID, { fields: 'id,username' }));
show('permissions (me)', await get('me/permissions'));
if (dbg.data) console.log(`[${P}] scopes: ${(dbg.data.scopes || []).join(', ') || '-'}; granular: ${JSON.stringify(dbg.data.granular_scopes || []).slice(0, 300)}`);
// --write-test: can the app write for this account? Makes an Instagram media container from a verse image
// that is already online, and never publishes it (an unused container expires after 24 hours).
if (process.argv.includes('--write-test') && env.IG_USER_ID) {
  const it = await (await db()).collection('items').findOne({ kind: 'verse-still', 'media.url': { $exists: true } }, { sort: { updatedAt: -1 } });
  if (!it) console.log(`[${P}] write test: no verse image to test with`);
  else {
    const u = new URL(`https://graph.facebook.com/${V}/${env.IG_USER_ID}/media`);
    const r = await (await fetch(u, { method: 'POST', body: new URLSearchParams({ image_url: it.media.url, caption: 'test (niet geplaatst)', access_token: tok }) })).json().catch(e => ({ error: { message: e.message } }));
    show('write test (container, not published)', r);
  }
}
await tiktokPart();
await close();

async function tiktokPart() {
  // --tiktok: the TikTok account the link posts to, and the state of the last uploads (inbox drafts)
  if (process.argv.includes('--tiktok')) {
    const { tiktokConfigured, tiktokCheck } = await import('../publish/tiktok.mjs');
    if (!tiktokConfigured()) console.log(`[${P}] tiktok: not linked`);
    else {
      const recent = await (await db()).collection('items').find({ 'results.tiktok.id': { $exists: true } }).sort({ publishedAt: -1 }).limit(5).toArray();
      const ids = recent.map(it => it.results.tiktok.id);
      const r = await tiktokCheck(ids);
      console.log(`[${P}] tiktok account: ${JSON.stringify(r.creator)}`);
      for (const it of recent) console.log(`[${P}] tiktok ${it._id}: sent ${it.results.tiktok.at ? new Date(it.results.tiktok.at).toISOString() : '-'} ${JSON.stringify(it.results.tiktok).slice(0, 200)} -> now ${JSON.stringify(r[it.results.tiktok.id]).slice(0, 400)}`);
    }
  }
}
