# Setup

## Done (23 Oct 2026)

| Part | Status |
|---|---|
| Repo `AlexLamper/bijbelstudie-marketing` | Engine, studio, planner, workflows pushed |
| Database | MongoDB Atlas, project BijbelStudie-Marketing, cluster `marketing`, database `bijbelstudie_marketing` |
| Studio | Vercel project `bijbelstudie-studio` -> https://bijbelstudie-studio.vercel.app (password in Vercel env `STUDIO_PASSWORD`) |
| Media storage | Vercel Blob store `bijbelstudie-media` (fra1), attached to the studio; the engine uploads through the studio with `ENGINE_KEY` |
| Engine config | `.env.engine` in this private repo (database, studio URL, engine key). A GitHub Actions secret with the same name overrides it |
| Notifications | GitHub issues with label `studio` (GitHub emails you). Optional later: Resend |
| First content | Week 44 (26 Oct - 1 Nov): 18 items, written by Claude in chat, rendered by the Render workflow |

## Still needs you (in this order)

### 1. Claude for the weekly planner (2 min) - before Friday 30 Oct

On your computer: `npm i -g @anthropic-ai/claude-code`, then `claude setup-token`, log in.
Put the token in GitHub: repo -> Settings -> Secrets and variables -> Actions -> New repository secret -> name `CLAUDE_CODE_OAUTH_TOKEN`.
(This one stays out of `.env.engine`: it gives access to your Claude account.)

### 2. Instagram + Facebook (15 min) - needed before anything is posted

Your Instagram is a Business account; it must be linked to a Facebook Page.
1. developers.facebook.com -> My Apps -> Create app -> type **Business** -> name "BijbelStudie Studio".
2. Add products **Instagram** (API setup with Facebook Login) and **Facebook Login for Business**. Keep the app in Development mode (works for your own accounts, no App Review).
3. Graph API Explorer -> this app -> "Get Page Access Token" with: `instagram_basic, instagram_content_publish, instagram_manage_insights, instagram_manage_comments, pages_show_list, pages_read_engagement, pages_manage_posts, business_management`.
4. Access Token Debugger -> Extend. Then `GET /me/accounts` with that token -> copy your Page's `id` and `access_token`.
5. `GET /{page-id}?fields=instagram_business_account` -> copy the Instagram id.
6. Send the three values to Claude (or add them to `.env.engine` as `META_PAGE_TOKEN`, `FB_PAGE_ID`, `IG_USER_ID`).

### 3. Voice (5 min) - when you want the explainers spoken

ElevenLabs Starter (~$6/month): pick a calm Dutch-capable male and female voice in the Voice Library, copy their voice ids and your API key -> `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_MALE`, `ELEVENLABS_VOICE_FEMALE`. Until then explainers render with burned-in captions and no voice.

### 4. YouTube Shorts (10 min)

1. console.cloud.google.com -> new project -> enable **YouTube Data API v3**.
2. OAuth consent screen -> External -> add yourself as test user -> **Publish app** (otherwise the token dies after 7 days).
3. Credentials -> OAuth client ID -> Web application -> redirect URI `https://developers.google.com/oauthplayground`.
4. developers.google.com/oauthplayground -> gear -> "Use your own OAuth credentials" -> scopes `https://www.googleapis.com/auth/youtube.upload` and `https://www.googleapis.com/auth/youtube.readonly` -> log in with the BijbelStudie channel -> exchange -> copy the refresh token.
5. Values: `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`.

### 5. TikTok (15 min + audit)

1. developers.tiktok.com -> create app -> add **Login Kit** and **Content Posting API** (Direct Post). Redirect URI `https://www.bijbelstudie.io/`.
2. In the repo: `TIKTOK_CLIENT_KEY=... TIKTOK_CLIENT_SECRET=... TIKTOK_REDIRECT_URI=https://www.bijbelstudie.io/ node engine/cli/tiktok-login.mjs` -> open the URL, log in as the BijbelStudie TikTok, copy `code` from the address bar, run again with the code.
3. Values: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN`. Submit the app for audit; until it passes, TikTok posts stay private and the studio marks them "privé".

### Optional

- `PLATFORM_MONGODB_URI` + `PLATFORM_MONGODB_DB`: a read-only user on the BijbelStudie platform database, for "new users per day" in the stats.
- `RESEND_API_KEY` + `NOTIFY_TO`: email instead of GitHub issues.
- `content/competitors.json`: Instagram usernames to learn from.

## How it runs

- **Friday** 16:00: Plan week (Claude) -> import -> render -> you get "Week .. staat klaar".
- **Studio**: approve, "Aanpassen" with a comment, or remove. "Aanpassingen naar Claude" -> revised within 30 min.
- **Every 30 min** (06:00-22:30): approved items whose time has come are posted.
- **Daily** 05:15: stats, comments, cleanup of old media.
- **Anything fails** -> a GitHub issue with the log.
