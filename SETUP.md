# Setup

## Done (23 Oct 2026)

| Part | Status |
|---|---|
| Repo `AlexLamper/bijbelstudie-marketing` | Engine, studio, planner, workflows pushed |
| Database | MongoDB Atlas, project BijbelStudie-Marketing, cluster `marketing`; one database per project (`bijbelstudie_marketing`, later `bijbelquiz_marketing`) |
| Studio | Vercel project `bijbelstudie-studio` -> https://bijbelstudie-studio.vercel.app (password in Vercel env `STUDIO_PASSWORD`) |
| Media storage | Vercel Blob store `bijbelstudie-media` (fra1), attached to the studio; the engine uploads through the studio with `ENGINE_KEY` |
| Secrets | GitHub Actions secrets `MONGODB_URI` and `ENGINE_KEY` (engine), Vercel env vars (studio). Nothing secret is in git; `engine.config` holds only the studio URL and default project. To run the engine on your own machine, put secrets in `.env.engine` (gitignored) |
| Notifications | GitHub issues with label `studio` (GitHub emails you). Optional later: Resend |
| First content | Week 44 (26 Oct - 1 Nov): 18 items, written by Claude in chat, rendered by the Render workflow |
| Projects | BijbelStudie (on). BijbelQuiz scaffolded in `projects/bijbelquiz/` (off until its brand files, screenshots and accounts are in) |

## Still needs you

Everything is done from the studio's **Instellingen** page (per project). It shows a checklist of
what is set and what is missing, and when each job last ran.

1. **Weekplanner (before Friday 30 Oct):** on your computer run `claude setup-token`, log in, and paste
   the token under Instellingen > Sleutels > Claude. (A GitHub secret `CLAUDE_CODE_OAUTH_TOKEN` also works.)
2. **YouTube:** app done (Google Cloud project "BijbelStudie", OAuth client "Marketing Studio (YouTube)").
   Click Koppel and pick the BijbelStudie channel (@bijbelstudie-io).
3. **Instagram + Facebook:** a Meta developer app (Claude creates it in your Chrome once you are logged in
   at developers.facebook.com), then paste App ID + secret on Instellingen and click Koppel.
4. **TikTok:** a TikTok developer account (sign up at developers.tiktok.com), then the same. Until TikTok
   audits the app, posts are private.
5. **Optional:** ElevenLabs or Google TTS key (voice for explainers), a read-only user on the product
   database (new users per day), Resend (email instead of GitHub issues) - all under Sleutels.

Linking: the studio does the OAuth flow, stores tokens sealed with ENGINE_KEY (AES-256-GCM) in the
project's database, and the engine loads them before publishing. Approved posts whose platform is not
linked yet wait up to 24 hours, then that platform is skipped for that post.

## Secrets per project

All GitHub Actions secrets reach the engine automatically (no workflow edits). Shared secrets have no
prefix: `MONGODB_URI`, `ENGINE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, voices, app credentials. Account secrets
(where things get posted, whose users get counted) belong to one project. BijbelStudie uses them
without a prefix. Every other project uses its `envPrefix` from `project.json`, e.g. `BIJBELQUIZ_META_PAGE_TOKEN`,
`BIJBELQUIZ_IG_USER_ID`, `BIJBELQUIZ_FB_PAGE_ID`, `BIJBELQUIZ_YT_REFRESH_TOKEN`, `BIJBELQUIZ_TIKTOK_REFRESH_TOKEN`,
`BIJBELQUIZ_PLATFORM_MONGODB_URI`. A project never falls back to another project's accounts.

## How it runs

- **Friday** 16:00: Plan week (Claude, one project after the other) -> import -> render -> you get "<Project>: week .. staat klaar".
- **Studio**: approve, "Aanpassen" with a comment, or remove. "Aanpassingen naar Claude" -> revised within 30 min.
- **Every 30 min** (06:00-22:30): approved items of every enabled project whose time has come are posted.
- **Daily** 05:15: stats, comments, cleanup of old media.
- **Anything fails** -> a GitHub issue with the log.
