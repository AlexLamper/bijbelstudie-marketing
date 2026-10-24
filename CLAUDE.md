# Marketing engine (BijbelStudie, BijbelQuiz, ...)

Marketing automation for Alex's products. Claude plans and writes; the engine renders, holds everything for Alex's approval in the studio, publishes what he approved, and measures. One engine and one studio serve every project in `projects/`. See `README.md` for the flow and `SETUP.md` for accounts.

Projects:
- `bijbelstudie` (on) - bijbelstudie.io + iOS/Android app. Website code: AlexLamper/BijbelStudie (Next.js 15, MongoDB, Stripe, Resend, Vercel). App code: AlexLamper/bijbelstudie-app (Flutter, RevenueCat).
- `bijbelquiz` (off, scaffolded) - bijbelquiz.com + app. Code: AlexLamper/bijbelquiz, AlexLamper/bijbelquiz-app. Its `brand/` is a draft to verify.

## Read first, for the project you work on (`P/` = `projects/<id>/`)

1. `P/project.json` - name, database, colours, logos, end card, platforms.
2. `P/brand/product.md` - what the product is and does. Never claim anything that is not in it.
3. `P/brand/voice-and-rules.md` - audience, voice, hooks and the hard rules.
4. `P/brand/visual.md` - logo/CTA rules and which screenshot shows what. BijbelStudie's full design system is the "BijbelStudie" Design System artifact on claude.ai.
5. `engine/spec.mjs` - the spec contract. `planner/PLAN.md` (steps) + `P/plan.md` (that project's recipe and experiments).

## Hard rules

- Nothing is published without Alex's approval: only items with status `approved` are ever touched by `publish-due`.
- Verse words always come from `data/statenvertaling/` (engine/verses.mjs), never typed by a model. A verse that went out is never reused (Mongo `verses` per project, exported to `P/content/used-verses.json`).
- Secrets never go in git. They live in GitHub Actions secrets (reach the engine as `SECRETS` JSON), keys pasted in the studio (Instellingen > Sleutels; sealed with ENGINE_KEY in Mongo `secrets`, loaded by engine/db.mjs), linked accounts (Mongo `connections`, sealed), Vercel env vars (studio) and, for local runs only, `.env.engine` (gitignored). `engine.config` is committed and holds only non-secret settings. GitHub secrets win over studio keys.
- Account secrets are per project: a project with an `envPrefix` only uses `<PREFIX>KEY` for accounts and never falls back to another project's (engine/project.mjs `ACCOUNT_KEYS`).
- Dutch for everything a user sees; code, comments and identifiers in English. Plain hyphen "-", never a long dash.
- CTA like big apps: logo + name, one benefit, one button ("Download gratis"), official store badges, "Ook op <website>". Never "Zoek ... in de App Store", never "link in bio".
- BijbelStudie: dark grounds use the outlined mark (`logo-icon-dark.svg`) + `logo-wordmark-white.svg`; never an inverted logo.

## Layout

- `projects/<id>/` per product: `project.json`, `brand/`, `plan.md`, `assets/` (logos, screenshots, photos), `content/` (samples, queue = planner output, imported = record, used-verses.json, competitors.json). `projects/_template/` is copied by `npm run new-project`.
- Shared: `assets/` (fonts, store badges), `data/statenvertaling/`, `planner/` (PLAN.md daily planning steps, REVISE.md after review comments).
- `engine/` project (which project, paths, env prefix), env (config loader), days (local calendar days: which day to plan), spec (formats + experiment traits), verses, render (`render/stage.html` shared helpers + `render/templates/*.js` one file per group of formats, themed from project.json; `render.mjs` drives Chromium + ffmpeg, voices the template's spoken units and mixes music from `assets/music/`), tts (ElevenLabs with word timestamps, voice test set, Google fallback), experiments (traits, fair scores, Thompson-sampling allocation), library (voice test set + music moods + scoreboard update), storage (Vercel Blob via the studio; R2 optional), publish (Meta incl. carousels, YouTube, TikTok, Upload-Post), notify, db (one database per project), `cli/` jobs. `cli/each.mjs` runs a job for every enabled project.
- Formats: reel-explainer, reel-story (map/timeline/text/verse/photo/stat/tree/compare/word scenes), reel-kinetic, reel-quiz, reel-list, reel-verse, reel-demo, carousel, verse-still, post-spotlight, post-statement. Every reel: `style` (light/dark/photo), `music` (mood), `voice` (male/female/test-set key), `voiceStyle`, `captions`. A template registers `T[kind]` and, when it speaks, `T[kind].units`; it must render any time t as a pure function (frames render out of order).
- Experiments: `engine/experiments.mjs`. Daily the stats job scores every item per platform (48 h after publishing, vs the platform median) and updates Mongo `experiments.board`; every morning `export-context` writes `allocation.json` for the day to plan (formats per group, soft targets, voice budget for that day; remainders drawn at random per day so a 1-slot group still explores over the days), and the validator holds the plan to it (format counts exact for a day). `project.json` `experimentPriors` ({ trait: { value: [a, b] } }) gives values Alex favours a head start (BijbelStudie: reel-story, reel-kinetic). Studio page: `/<project>/experiments`.
- Daily planning: the studio timer starts `plan-week.yml` ("Plan day") at 04:00 UTC. `export-context` picks the first day from tomorrow (project timezone) without items and writes it to `content/context/target-week.json` (`days` = that one day, `idPrefix` like `2026-w46-tue`); more than 3 days ahead = skip. The week report only on Mondays. Render sends one "<dag> staat klaar" message per day.
- Rejected items: the stats job removes them a day after the rejection (media from storage, the item from Mongo `items`) and keeps a short record in Mongo `rejected`; `export-context` writes the last 60 days to `content/context/rejected.json` for the planner. Published items are never removed (only their media, after 60 days).
- No repeats: `engine/repeats.mjs` (verse of the day never again, any shown verse not within 180 days, `subject` not within 12 weeks, no near-identical hook within 26 weeks), checked by the validator against `content/context/history.json` and again on import.
- One voice per video: `render.mjs` voices the whole script in one ElevenLabs request (seed per item) and cuts it into the template's units, so lines cannot sound like different speakers. Never voice units separately.
- Which project a script uses: `PROJECT` env, else a path argument inside `projects/<id>/`, else `DEFAULT_PROJECT` (engine.config).
- Studio: `app/` (`/` overview, `/<project>/...` pages, `/api/<project>/...`, `/api/engine/*` for the engine), `components/` (ui.tsx buttons/cards - use them so every control has pointer, hover, focus and disabled states), `lib/` (projects.ts reads `projects.generated.json`, written by `scripts/sync-projects.mjs`).
- `.github/workflows/` plan-week ("Plan day", daily, one day per project, matrix per project), revise (one project), render, publish (also runs `cli/kick.mjs`: starts Revise/Render when the studio asked), stats (also the approval reminder), ci; shared steps in `.github/actions/`.
- Studio Instellingen: setup checklist, account linking (OAuth: `app/api/oauth/*`, `lib/connections.ts`), Sleutels (`lib/secrets.ts`), ElevenLabs voices + voice test set (`lib/elevenlabs.ts`, Mongo `settings.voices`), last runs (engine heartbeats in Mongo `runs`).
- By hand: `music.yml` (generate the music library with ElevenLabs Music, guards the voice budget), `samples.yml` (render samples with real voice and music, prints public links).

## Workflow schedules

GitHub runs a scheduled workflow as the user who last changed its file. Commits from these sessions are attributed to the GitHub user `claude`, which has no access to this private repo, so schedules silently stop. Commit any change under `.github/workflows/` with `--author="AlexLamper <143872753+AlexLamper@users.noreply.github.com>"`.

## Check before you commit

`npm run check` (syntax + every project's samples valid), `node scripts/sync-projects.mjs` after changing any `project.json` or logo, and render one sample: `node engine/render/render.mjs projects/bijbelstudie/content/samples/w45-verse-mon.json` (and the sample of any format you touched; look at frames with ffmpeg + Read).
