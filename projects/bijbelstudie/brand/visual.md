# Visual brand - quick reference for renderers

The full system (all tokens, both themes, logos, screenshots, photos, slide templates) is the "BijbelStudie" Design System artifact on claude.ai. This file holds what the renderers need.

## Colours

| Token | Hex | Use |
|---|---|---|
| teal | #0D9488 | brand fill; white text only bold 19px+ |
| teal-dark | #0F766E | white text at any size; teal as text |
| hero-cta | #0D7A66 | main CTA button |
| teal-soft | #CCFBF1 | chips, calm blocks |
| teal-faint | #F0FDFA | quote ground |
| ink | #111827 | headings |
| ink-body | #374151 | body |
| ink-muted | #6B7280 | secondary text |
| background | #F3F4F6 | page ground |
| surface | #FFFFFF | cards, light slides |
| panel-dark | #152229 | dark slides, CTA and end cards |
| gold | #CA9A16 | Pro only; only #422E04 text on it |

Gradients: banner `linear-gradient(135deg, #0F766E, #0F172A)`, verse `linear-gradient(#4B3A63, #7E5E6E 45%, #C88463)`, tree scene `linear-gradient(#243A4A, #3C5A60 42%, #5E7A63 74%, #2F4A3A)`.

## Type

- Inter (sans) for headlines and body. Bold 700, slight negative tracking on headlines.
- Lora (serif) for scripture and hook lines.
- On 1080px canvases: hook 88px Lora 600, title 60px Inter 700, body 40px Inter, verse 56px Lora, eyebrow 28px Inter 700 caps +3px tracking, CTA 44px Inter 700.

## Formats and safe areas

- Post/carousel 1080x1350, 96px margin. Square 1080x1080.
- Reel/Story/TikTok 1080x1920: no text in the top and bottom 250px or the right 160px.
- Instagram API wants JPEG; export carousels as JPEG quality 92.

## Logo and CTA

- Light grounds: `assets/logos/logo-full.svg` (paths in this file are inside `projects/bijbelstudie/`; store badges are shared in the repo's `assets/badges/`).
- Dark grounds: `assets/logos/logo-icon-dark.svg` (charcoal tile with a thin white outline) + `assets/logos/logo-wordmark-white.svg`, beside or under it. Never an inverted or grey tile (the old `logo-full-white` is not used). No logo on teal.
- End card / CTA slide, centred on `panel-dark`: icon 208px, wordmark 62px, one benefit headline (Inter 700 80px), one button (`#0D7A66`, shadow `0 10px 24px -8px rgba(13,122,102,.55)`, radius 22px, Inter 700 50px: "Download gratis"), store badges 92px tall (`assets/badges/app-store.png`, `play-store.png` at the repo root), "Ook op bijbelstudie.io" 30px at 70% white. Holds 2-3 s in a reel; the button may pulse once.
- Implementation: `engine/render/stage.html` (`endCard()`), themed from `project.json`.

## Sources of images
- App screenshots: `assets/screenshots/` in this project - 20 current screens from 21 October 2026, 1170x2391, status bar cropped off (the mockup draws its own). The set in the app repo's `screenshots/app-store-connect-2026-09-18/` is outdated: never use it. `01-start` and `15-profiel` show Alex's own account; crop the invite link if legible.
- Verse backgrounds: `assets/photos/001-365.jpg` in this project (from the website's `public/images/daytext/`), with a 45-55% black scrim.
