# Setup - from zero to running

Everything that needs your login, in order. Each step says what you get, which secret it becomes, and roughly how long it takes. All secrets go to **GitHub -> repo -> Settings -> Secrets and variables -> Actions**; the studio's ones also go to **Vercel -> project -> Settings -> Environment Variables**.

Cost when done: **EUR 0/month** (plus ~$6 if you pick ElevenLabs, ~$16-24 if you use the Upload-Post bridge for TikTok before TikTok's audit).

---

## 1. Repo (2 min)

1. Create the empty private repo `AlexLamper/bijbelstudie-marketing` on GitHub (no README).
2. Tell Claude - it attaches the repo and pushes everything.

## 2. Brain: Claude (2 min)

On your computer: `npm i -g @anthropic-ai/claude-code`, then `claude setup-token`. Log in with your Claude account.
- Secret: `CLAUDE_CODE_OAUTH_TOKEN`
- Uses your Pro plan's limits on Fridays (planner) and when you press "Aanpassingen naar Claude". No API bill.

## 3. Database: MongoDB Atlas (5 min)

1. In Atlas, either create a new project with a free **M0** cluster, or use your existing cluster.
2. Create a database user for the engine; copy the connection string.
   - Secret: `MONGODB_URI` (database name defaults to `bijbelstudie_marketing`)
3. For the growth metric (new BijbelStudie users per day): on the **platform** cluster, create a user with role `read` on the platform database only.
   - Secrets: `PLATFORM_MONGODB_URI`, `PLATFORM_MONGODB_DB`
4. Network access: allow `0.0.0.0/0` (GitHub Actions and Vercel have no fixed IPs; the password protects it).

## 4. Media storage: Cloudflare R2 (5 min)

1. Cloudflare dashboard -> R2 -> create bucket `bijbelstudie-media` (free tier).
2. Bucket -> Settings -> **Public Development URL** -> enable. Copy the `https://pub-....r2.dev` URL.
3. R2 -> Manage API tokens -> create token with **Object Read & Write** on this bucket.
- Secrets: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`

## 5. Voice (5 min) - pick one, or both

**Free: Google Cloud Text-to-Speech**
1. console.cloud.google.com -> new project "bijbelstudie-marketing" -> add a billing account (needed even for the free tier: 1M characters/month on Chirp 3 HD; we use ~2%).
2. Enable **Cloud Text-to-Speech API**. Credentials -> API key -> restrict it to that API.
- Secret: `GOOGLE_TTS_API_KEY` (voices: `nl-NL-Chirp3-HD-Charon` male, `nl-NL-Chirp3-HD-Aoede` female; change via `GOOGLE_TTS_VOICE_MALE/FEMALE`)

**Best quality: ElevenLabs Starter (~$6/month)** - when set, it is used instead of Google.
- Pick two Dutch-capable voices in the Voice Library (one male, one female), copy their voice ids.
- Secrets: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_MALE`, `ELEVENLABS_VOICE_FEMALE`

## 6. Instagram + Facebook (15 min) - free, works from day 1

You already have a Business account. It must be connected to a Facebook Page (Instagram -> Settings -> Accounts Center, or Page settings -> Linked accounts).
1. developers.facebook.com -> My Apps -> **Create app** -> type **Business**. Name it "BijbelStudie Studio".
2. Add products: **Instagram** (API setup with Facebook Login) and **Facebook Login for Business**.
3. Keep the app in **Development mode**: as admin of the app you can publish to your own accounts without App Review.
4. Graph API Explorer -> select the app -> "Get Page Access Token" with permissions:
   `instagram_basic, instagram_content_publish, instagram_manage_insights, instagram_manage_comments, pages_show_list, pages_read_engagement, pages_manage_posts, business_management`
5. Exchange it for a long-lived token (Access Token Debugger -> "Extend"), then call `GET /me/accounts` with it and copy your Page's own `access_token` (Page tokens from a long-lived user token don't expire).
6. `GET /{page-id}?fields=instagram_business_account` gives the Instagram user id.
- Secrets: `META_PAGE_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`

## 7. YouTube Shorts (10 min) - free

1. In the same Google Cloud project: enable **YouTube Data API v3**.
2. OAuth consent screen -> External -> add yourself as test user -> then **Publish app** (otherwise the refresh token dies after 7 days; you'll see an "unverified app" warning when logging in yourself - that's fine).
3. Credentials -> OAuth client ID -> Web application -> redirect URI `https://developers.google.com/oauthplayground`.
4. developers.google.com/oauthplayground -> gear icon -> "Use your own OAuth credentials" -> scopes `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube.readonly` -> log in with the BijbelStudie YouTube channel -> exchange code -> copy the refresh token.
- Secrets: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`

## 8. TikTok (15 min + audit wait)

1. developers.tiktok.com -> create an app -> add **Login Kit** and **Content Posting API** (enable Direct Post). Redirect URI: `https://www.bijbelstudie.io/`.
2. On your computer, in the repo: `TIKTOK_CLIENT_KEY=... TIKTOK_CLIENT_SECRET=... TIKTOK_REDIRECT_URI=https://www.bijbelstudie.io/ node engine/cli/tiktok-login.mjs` -> open the URL, log in with the BijbelStudie TikTok account, copy `code` from the address bar, run the script again with the code.
- Secrets: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`
3. Submit the app for **audit** (free). Until it passes, TikTok keeps posts private: the studio shows them as "TikTok (privé)" and you post those by hand.
4. Optional bridge: Upload-Post account (~$16-24/month) connected to TikTok -> secrets `UPLOADPOST_API_KEY`, `UPLOADPOST_USER`. When set, TikTok posts go through it publicly.

## 9. Notifications (2 min)

Reuse the website's Resend key (bijbelstudie.io is already verified there).
- Secrets: `RESEND_API_KEY`, `NOTIFY_TO` (your email), `DASHBOARD_URL` (the studio URL from step 10)

## 10. The studio (5 min)

1. vercel.com -> Add New -> Project -> import `bijbelstudie-marketing` -> deploy.
2. Env vars: `MONGODB_URI`, `STUDIO_PASSWORD` (choose one), `GITHUB_REPO=AlexLamper/bijbelstudie-marketing`, `GITHUB_DISPATCH_TOKEN` (GitHub -> Settings -> Developer settings -> Fine-grained token -> this repo only -> Contents: Read and write).
3. Optional: domain `studio.bijbelstudie.io`.
- Note: Vercel's Hobby plan is meant for non-commercial use. For a strictly by-the-book free setup, run the studio locally (`npm install && npm run dev`) - the engine itself runs entirely in GitHub Actions either way.

## 11. Go

1. GitHub -> Actions -> **Plan week** -> Run workflow. About 15-25 minutes later you get the email "Week .. staat klaar".
2. Open the studio, approve, comment ("Aanpassen") or remove items. Press **Aanpassingen naar Claude** if you commented.
3. From then on: planner every Friday, publishing every 30 minutes for approved items, stats every morning.
4. Fill `content/competitors.json` with a few Instagram accounts to learn from.

## Secrets checklist

| Secret | Step | Needed for |
|---|---|---|
| CLAUDE_CODE_OAUTH_TOKEN | 2 | planner, revise |
| MONGODB_URI | 3 | everything |
| PLATFORM_MONGODB_URI, PLATFORM_MONGODB_DB | 3 | signups metric (optional) |
| R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL | 4 | render, publish |
| GOOGLE_TTS_API_KEY or ELEVENLABS_* | 5 | explainer voice |
| META_PAGE_TOKEN, IG_USER_ID, FB_PAGE_ID | 6 | Instagram, Facebook, stats, comments |
| YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN | 7 | YouTube Shorts |
| TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN (or UPLOADPOST_*) | 8 | TikTok |
| RESEND_API_KEY, NOTIFY_TO, DASHBOARD_URL | 9 | emails |

Anything not set is skipped, not broken: e.g. without YouTube secrets the engine posts everywhere else and marks YouTube "not configured".
