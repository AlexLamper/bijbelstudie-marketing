// Diagnoses the Instagram/Facebook link without posting anything (run via maintenance.yml): where the
// Page token comes from, what Meta says about it (debug_token), and whether the Page and the Instagram
// account can be read with it. Prints no secrets.
import '../env.mjs';
import { close } from '../db.mjs';
import { applyConnections } from '../connections.mjs';
import { project } from '../project.mjs';

const env = process.env; const P = project().id;
const fromKey = !!env.META_PAGE_TOKEN;   // a GitHub secret or a studio key wins over the linked account
const linked = await applyConnections();
const tok = env.META_PAGE_TOKEN;
console.log(`[${P}] token from: ${fromKey ? 'META_PAGE_TOKEN (GitHub secret or studio key - overrides the linked account)' : linked.meta ? `the linked account "${linked.meta}"` : 'nowhere'}; FB_PAGE_ID ${env.FB_PAGE_ID || '-'}, IG_USER_ID ${env.IG_USER_ID || '-'}`);
if (!tok) { await close(); process.exit(0); }
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
await close();
