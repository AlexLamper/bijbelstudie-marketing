// One-time TikTok login to get a refresh token (valid ~1 year; the engine rotates it in Mongo).
//   1. node engine/cli/tiktok-login.mjs            -> prints a login URL; open it, log in as the project's TikTok account (PROJECT=<id> for another project)
//   2. you land on your redirect URL; copy the "code" from the address bar
//   3. node engine/cli/tiktok-login.mjs <code>     -> prints TIKTOK_REFRESH_TOKEN for GitHub secrets
// Env: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI (exactly as registered in the TikTok app)
import '../env.mjs';
import { project } from '../project.mjs';
const P = project();
const { TIKTOK_CLIENT_KEY: key, TIKTOK_CLIENT_SECRET: secret, TIKTOK_REDIRECT_URI: redirect } = process.env;
if (!key || !secret || !redirect) { console.error('Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REDIRECT_URI'); process.exit(1); }
const code = process.argv[2];
if (!code) {
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.search = new URLSearchParams({ client_key: key, scope: 'user.info.basic,video.publish,video.upload,video.list', response_type: 'code', redirect_uri: redirect, state: P.id });
  console.log(`Open this URL and log in:\n\n${u}\n\nThen run: node engine/cli/tiktok-login.mjs <code from the address bar>`);
} else {
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: key, client_secret: secret, code: decodeURIComponent(code), grant_type: 'authorization_code', redirect_uri: redirect }) });
  const j = await r.json();
  if (!r.ok || j.error) { console.error(j); process.exit(1); }
  console.log(`${P.envPrefix}TIKTOK_REFRESH_TOKEN=${j.refresh_token}\n(scopes: ${j.scope}; expires in ${Math.round(j.refresh_expires_in / 86400)} days)`);
}
