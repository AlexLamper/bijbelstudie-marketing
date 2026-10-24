# Marketing engine + studio

Plans, makes, publishes and measures social content for any number of products (projects).
Alex only approves. Today: **BijbelStudie** (on) and **BijbelQuiz** (scaffolded, off).

```
Friday      per project: Claude (planner/PLAN.md + projects/<id>/plan.md) reads results + brand
            -> report, next week's specs, comment replies
            validate -> import to the project's Mongo database -> render (Playwright + ffmpeg,
            voice via ElevenLabs/Google TTS) -> Vercel Blob -> "<Project>: week ready"
Studio      pick a project, approve / comment / remove (comments -> "Aanpassingen naar Claude" -> Revise)
Every 30m   approved items whose time has come -> Instagram, Facebook, YouTube Shorts, TikTok
            (approving gives an item the next free posting time: lib/postingSlots.ts)
Daily       metrics, followers, new users, new comments; competitors on Mondays
```

| Part | Where |
|---|---|
| Projects | `projects/<id>/` - `project.json` (name, database, colours, logos, end card), `brand/`, `plan.md`, `assets/`, `content/` |
| Shared | `assets/` (fonts, store badges), `data/statenvertaling/` (Bible text), `planner/` (generic planner steps) |
| Spec format | `engine/spec.mjs` - examples in `projects/<id>/content/samples/` |
| Templates | `engine/render/stage.html` (verse-still, reel-verse, reel-demo, reel-explainer, post-spotlight, post-statement), themed per project |
| Publishers | `engine/publish/` (Meta, YouTube, TikTok, Upload-Post bridge) |
| Jobs | `engine/cli/` and `.github/workflows/` (every job runs for every enabled project) |
| Studio | Next.js app in `app/` (routes `/<project>/...`), `components/`, `lib/` |

## Commands

```bash
npm install
npm run projects                    # list projects (on/off, database, env prefix)
npm run validate                    # check specs in the default project's queue (PROJECT=<id> for another)
node engine/render/render.mjs projects/bijbelstudie/content/samples/w45-reel-demo-wed.json   # -> out/bijbelstudie/
npm run samples                     # render every sample of every enabled project
npm run dev                         # studio on localhost:3000 (needs .env.local, see .env.example)
```

## Add a project (e.g. a new app)

```bash
npm run new-project -- myapp --name "MyApp" --web myapp.com --accent "#35548c" \
  --logo-dark path/to/mark-on-dark.svg --logo-full path/to/logo.svg
```

This creates `projects/myapp/` from `projects/_template/`, switched off, with its own database
(`myapp_marketing`), colours derived from the accent, and placeholder logos where you gave none. Then:

1. Fill in `brand/product.md`, `brand/voice-and-rules.md`, `brand/visual.md` and `plan.md` (the recipe).
2. Real logos in `assets/logos/`, app screenshots in `assets/screenshots/` (optional photos in `assets/photos/`).
3. Check: `node engine/render/render.mjs projects/myapp/content/samples/sample-post-statement.json`.
4. Accounts as GitHub secrets with the project's prefix: `MYAPP_META_PAGE_TOKEN`, `MYAPP_IG_USER_ID`, ... (see SETUP.md).
5. `"enabled": true` in `project.json`, commit, push. Vercel redeploys the studio with the new project
   in the switcher; the workflows pick it up on their next run.

Nothing else changes: same engine, same studio, same workflows, same Vercel project and Mongo cluster.

Setup of all accounts: see `SETUP.md`.
