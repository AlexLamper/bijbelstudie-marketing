# BijbelStudie marketing engine

Marketing automation for BijbelStudie (bijbelstudie.io + iOS/Android app). Claude plans and writes; the engine renders, holds everything for Alex's approval in the studio, publishes what he approved, and measures. See `README.md` for the flow and `SETUP.md` for accounts.

Website code: AlexLamper/BijbelStudie (Next.js 15, MongoDB, Stripe, Resend, Vercel). App code: AlexLamper/bijbelstudie-app (Flutter, RevenueCat).

## Read first, every session

1. `brand/product.md` - what BijbelStudie is and does. Never claim anything that is not in it.
2. `brand/voice-and-rules.md` - audience, voice, hooks and the hard rules.
3. `brand/visual.md` - colours, type, logo and CTA rules; the full design system is the "BijbelStudie" Design System artifact on claude.ai.
4. `engine/spec.mjs` - the spec contract. `planner/PLAN.md` - the weekly recipe and experiments.

## Hard rules

- Nothing is published without Alex's approval: only items with status `approved` are ever touched by `publish-due`.
- Verse words always come from `data/statenvertaling/` (engine/verses.mjs), never typed by a model. A verse that went out is never reused (Mongo `verses`, exported to `content/used-verses.json`).
- Config lives in `.env.engine` (private repo, Alex chose this; never make the repo public), GitHub Actions secrets (override it; `CLAUDE_CODE_OAUTH_TOKEN` only there), Vercel env vars (studio) and Mongo `tokens` (rotating OAuth tokens).
- Dutch for everything a user sees; code, comments and identifiers in English. Plain hyphen "-", never a long dash.
- CTA like big apps: logo + name, one benefit, one button ("Download gratis"), official store badges, "Ook op bijbelstudie.io". Never "Zoek ... in de App Store", never "link in bio".
- Dark grounds use the outlined mark (`logo-icon-dark.svg`) + `logo-wordmark-white.svg`; never an inverted logo.

## Layout

- `brand/` knowledge, `assets/` (fonts, logos, badges, 20 screenshots of 21 Oct 2026, 365 daytext photos), `data/statenvertaling/`
- `engine/` env (.env.engine loader), spec, verses, render (`render/stage.html` templates + `render.mjs`), tts, storage (Vercel Blob via the studio; R2 optional), publish (Meta, YouTube, TikTok, Upload-Post), notify (Resend), db, `cli/` jobs
- `planner/` PLAN.md (weekly) and REVISE.md (after review comments)
- `content/` samples, queue (planner output), imported (record), used-verses.json, competitors.json
- `app/`, `lib/`, `middleware.ts` - the studio (Next.js 15 + Tailwind 4 + MongoDB driver)
- `.github/workflows/` plan-week, revise, render, publish, stats, ci

## Check before you commit

`for f in $(find engine -name '*.mjs'); do node --check $f; done && node engine/cli/validate.mjs content/samples` and render one sample with `node engine/render/render.mjs content/samples/w45-verse-mon.json`.
