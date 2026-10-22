# BijbelStudie marketing engine

Plans, makes, publishes and measures BijbelStudie's social content. Alex only approves.

```
Friday      Claude (planner/PLAN.md) reads results + brand -> writes report, next week's specs, comment replies
            validate -> import to Mongo -> render (Playwright + ffmpeg, voice via Google TTS/ElevenLabs) -> R2
            email "week ready"
Studio      Alex approves / comments / removes  (comments -> "Aanpassingen naar Claude" -> revise workflow)
Every 30m   approved items whose time has come -> Instagram, Facebook, YouTube Shorts, TikTok
Daily       metrics, followers, new BijbelStudie users, new comments; competitors on Mondays
```

| Part | Where |
|---|---|
| Brand knowledge | `brand/` (product facts, voice and rules, visual) |
| Spec format | `engine/spec.mjs` - examples in `content/samples/` |
| Templates | `engine/render/stage.html` (verse-still, reel-verse, reel-demo, reel-explainer, post-spotlight, post-statement) |
| Bible text | `data/statenvertaling/` - verse words always come from here |
| Publishers | `engine/publish/` (Meta, YouTube, TikTok, Upload-Post bridge) |
| Jobs | `engine/cli/` and `.github/workflows/` |
| Studio | Next.js app in `app/` |

## Commands

```bash
npm install
npm run validate                    # check specs in content/queue
node engine/render/render.mjs content/samples/w45-reel-demo-wed.json   # render one spec to out/
npm run samples                     # render all samples
npm run dev                         # studio on localhost:3000 (needs .env.local, see .env.example)
```

Setup of all accounts: see `SETUP.md`.
