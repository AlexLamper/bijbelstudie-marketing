# BijbelStudie - weekly recipe and rules

Read together with `planner/PLAN.md` (the steps). Where this file is more specific, it wins.
Paths here (`brand/`, `content/`) are inside this project folder, `projects/bijbelstudie/`.

## Report sections

- **Wat werkte** - top 3 items with numbers and why you think they worked
- **Wat niet** - bottom 3 and the likely reason
- **Feedtest** - per feedType (video-first, spotlight, statement): average views, saves, shares
- **Stem-test** - male vs female explainer voice, same metrics
- **Groei** - followers and new BijbelStudie signups, compared to the week before
- **Volgende week** - what you change and why (one line per change)

## Fixed weekly recipe (until the data says otherwise)

| What | How many | Slot | Platforms |
|---|---|---|---|
| `verse-still` daily verse | 7 (every day) | 07:00 | instagram, facebook |
| Daily reel | 7 (every day) | 19:30 | instagram, facebook, tiktok, youtube |
| Feed test posts (`post-spotlight`, `post-statement`) | 4 | 12:00 Tue, Thu, Sat, Sun | instagram, facebook |

Daily reel mix per week: 3 `reel-explainer`, 2 `reel-demo`, 2 `reel-verse`.

## Experiments (set `experiment` on every item)

- **Feed test (weeks 1-3):** reels count as `feedType: "video-first"`; spot posts `"spotlight"`; statements `"statement"`. From week 4 shift the 4 test slots toward the winner (e.g. 3 winner + 1 other), and keep exploring a little.
- **Voice test:** alternate `voice` male/female across explainers; across two weeks both get the same number. From week 4 favour the winner (2:1).
- **Hooks:** set `experiment.hook` to the hook type. Rotate through all types; repeat winners with a variation (change one thing).
- **Post times (decided by data):** weeks 1-2 keep the fixed slots. From week 3 compare views and saves per slot in `performance.json` (use `slot`): try one alternative per type each week (verse 06:30 or 08:00, reels 12:30 or 21:00, feed posts 18:00) on one day only, set `experiment.note: "tijd-test HH:MM"`, and move the default slot when an alternative wins two weeks in a row. Report it under **Volgende week**.
- **Referral:** once a week, one item promotes "geef een vriend een week Pro cadeau" (caption, or a spotlight on `15-profiel`).

## Daily verse rules

- Exact words always come from the engine; you only choose `ref` and `photo` (1-365, vary them; calm landscapes).
- Pick verses that stand on their own and comfort, encourage or make you think. Mix well-known and lesser-known.
- Under 260 characters. No verse starting with a heading ("Een psalm van David"), no acrostic letters (Klaagliederen, Psalm 119 headings), no verse that misleads without its context.
- Never a verse from `content/used-verses.json`, never twice in one batch (also not as both still and reel).
- Caption: one or two short lines that invite reflection + one soft line to read the chapter with explanation in BijbelStudie. 3-5 hashtags.

## Reel rules

- **Hook first:** the first line must stop the scroll in under 2 seconds. Use the hook types in the brand rules.
- **reel-explainer:** 25-40 seconds spoken (about 70-110 words over hook + lines). One idea per reel. Lines are spoken Dutch: short sentences, no brackets, write numbers as words when spoken. Attach `verse` when you quote scripture (the screen shows exact SV text; the voice may paraphrase in modern Dutch - say "staat er" not a fake quote). Attach a `screenshot` when the line is about the app. Facts only from the verse itself, `brand/product.md`, the app's own context texts, or broadly accepted background (author, place, time). No denominational disputes, no doctrine claims a church would argue about. Last line points to BijbelStudie naturally.
- **reel-demo:** a hook + 3-4 scenes, each one benefit tied to a real screen (see `brand/visual.md` table). Captions are short and concrete.
- **reel-verse:** like the daily verse, but a different verse.
- Every reel ends with the approved end card; set `endCard.headline` to the benefit of that reel (max ~30 chars), `button` "Download gratis".

## Feed test posts

- `post-spotlight`: one feature, one benefit. Headline = the pain or question, sub = how BijbelStudie answers it, with a real number or fact from `brand/product.md`.
- `post-statement`: one strong sentence in the brand voice (relief, recognition, a fresh angle on Bible reading). Sub optional, short.

## Captions (all items)

- Dutch, "je", plain hyphen "-", no emoji spam (zero is fine), no "link in bio".
- End with a clear next step without "zoek ... in de App Store": e.g. "Download BijbelStudie gratis" or "Begin gratis op bijbelstudie.io".
- Hashtags: 3-6, relevant (#bijbel, #bijbelstudie, #bijbellezen, #versvandedag, book or theme tags).
- `basedOn`: the real fact, customer quote or feature the item rests on.

## Comment replies

Warm and short, in the brand voice. Do not answer trolling or theology fights - draft a calm one-liner or leave `reply` empty.
