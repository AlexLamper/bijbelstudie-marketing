# BijbelStudie - weekly recipe and rules

Read together with `planner/PLAN.md` (the steps). Where this file is more specific, it wins.
Paths here (`brand/`, `content/`) are inside this project folder, `projects/bijbelstudie/`.

## Report sections

- **Wat werkte** - top 3 items with numbers and why you think they worked
- **Wat niet** - bottom 3 and the likely reason
- **Experimenten** - from `experiments.json`: per trait the leader and the laggard with n and score (say when n is still too small to tell)
- **Groei** - followers and new BijbelStudie signups, compared to the week before
- **Volgende week** - what you change and why (one line per change)

## Weekly recipe

| What | How many | Slot | Platforms |
|---|---|---|---|
| `verse-still` daily verse | 7 (every day) | 07:00 | instagram, facebook |
| Main reel | 7 (1 a day) | 19:30 | instagram, facebook, tiktok, youtube |
| Extra test reels | 14 (2 a day) | 12:30 and 17:00 | tiktok, youtube |
| Feed posts | 4 | 12:00 Tue, Thu, Sat, Sun | instagram, facebook |

Which formats fill the reel and feed slots comes from `allocation.json` (`mainReels.format`,
`extraReels.format`, `feedPosts.format`). Main reels get what works best (the account's face on
Instagram); extra reels on TikTok and YouTube explore more. Ids: `<idPrefix>-<format short>-<day>`,
with `-a`/`-b` for the two extras of a day, e.g. `2026-w46-quiz-tue-a`.

## Formats

- **reel-explainer** - voice over hook + 3-9 lines, verse cards and app screens. See Reel rules.
- **reel-story** - a narrated story with animated scenes: `map` for journeys and places (keys from
  `engine/render/data/places.json`, in route order), `timeline` for a sequence with years (only broadly
  accepted dates; write "ca. 1000 v.Chr." when approximate), `text`, `verse`, `photo`. 5-7 scenes, one
  per spoken line. Great for persons, journeys, periods and "how did we get this book".
- **reel-kinetic** - big words appearing line by line. 2-8 lines of max ~8 words, one thought per line,
  `emphasis` = the one word that carries it. Works with and without voice (test both) and with music.
- **reel-quiz** - a question Bible readers can answer, 3-4 plausible options, the answer straight from
  the Bible text, `explain` in one or two sentences, `verseRef` for the verse it rests on. Caption invites answers in the comments.
  Facts only; no trick questions about translations or denominations.
- **reel-list** - "N dingen die je niet wist over ..." with 3-6 items, each a fact from the text with
  `verse`. Use `say` for the spoken version when it differs from the short title.
- **reel-verse** - like the daily verse; may be read aloud (`voice`) - test both.
- **reel-demo** - hook + 2-5 app screens with one benefit each.
- **carousel** - 5-8 slides for Instagram/Facebook: `cover` (the hook), then `point`/`text`/`verse`/
  `screen` slides; give saveable value ("bewaar dit"); the CTA slide is added automatically.
- **post-spotlight** / **post-statement** - see Feed posts.

## Traits (what each item tests)

- `voice`: a key from `voices.json` (`male`/`female` = the default voices, others = the test set);
  leave it out for no voice (only where the format allows; explainers and stories always speak).
- `voiceStyle`: `rustig` (steady narrator) or `levendig` (expressive). `captions`: `karaoke` (word by
  word), `block` or `none` - for voiced explainers, lists and stories.
- `music`: a mood from `voices.json` `musicMoods` (only those exist), else leave it out.
- `style`: `light`, `dark` or `photo` (reels and carousels).
- `experiment.hook` and `experiment.topic` on every item (`topic`: boek, persoon, context, woord,
  thema, vers, app, praktisch).
- When you repeat a winner, change one thing (another verse, another hook line) - not everything.
- Verses shown in reels and slides: under 230 characters; never one that starts with a heading.

## Experiments (set `experiment` on every item)

- **Formats, looks, voices, music, subtitles, hooks, topics:** divided by `allocation.json` (Thompson
  sampling on fair scores, see `engine/experiments.mjs`). You follow it; you do not pick winners yourself.
- **Feed posts:** `experiment.feedType` = `spotlight`, `statement` or `carousel`.
- **Post times (decided by data):** keep the fixed slots. From week 3 compare views and saves per slot in
  `performance.json` (use `slot`): try one alternative per type each week on one day only, set
  `experiment.note: "tijd-test HH:MM"`, and move the default slot when an alternative wins two weeks in a row.
- **Referral:** once a week, one item promotes "geef een vriend een week Pro cadeau" (caption, or a spotlight on `15-profiel`).

## Daily verse rules

- Exact words always come from the engine; you only choose `ref` and `photo` (1-365, vary them; calm landscapes).
- Pick verses that stand on their own and comfort, encourage or make you think. Mix well-known and lesser-known.
- Under 260 characters. No verse starting with a heading ("Een psalm van David"), no acrostic letters (Klaagliederen, Psalm 119 headings), no verse that misleads without its context.
- Never a verse from `content/used-verses.json`, never twice in one batch (also not as both still and reel).

## No repeats

Alex does not want repetitive videos. The validator (and the import after it) enforces this with
`content/context/history.json` (`engine/repeats.mjs`); plan around it from the start:
- **subject** - every item except `verse-still` / `reel-verse` has a `subject`: what it is about in a few
  words ("Ruth", "Paulus in Athene", "Blijdschap in Filippenzen", "Leesplannen"). Not within 12 weeks of an
  item with the same subject (app/praktisch topics: 4 weeks), never twice in one week. "Ruth" and "Het boek
  Ruth" count as the same. Prefer subjects the account has never done; the Bible has plenty.
- **verses** - a verse of the day is never used again (not as verse of the day, not in any item). Any verse
  shown in an item (lines, items, scenes, slides, quiz) is not shown again within 180 days. Overlapping
  ranges count (Psalmen 23:1 and Psalmen 23:1-3).
- **hooks** - not the same or nearly the same first line as one in the last 26 weeks. A winning hook
  *type* may be reused; the words may not.
- A winning format is repeated with a new subject, new verses and a new hook - never the same video again.
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
