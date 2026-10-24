# BijbelStudie - recipe and rules

Read together with `planner/PLAN.md` (the steps). Where this file is more specific, it wins.
Paths here (`brand/`, `content/`) are inside this project folder, `projects/bijbelstudie/`.

## Report sections (Mondays, about last week)

- **Wat werkte** - top 3 items with numbers and why you think they worked
- **Wat niet** - bottom 3 and the likely reason
- **Experimenten** - from `experiments.json`: per trait the leader and the laggard with n and score (say when n is still too small to tell)
- **Groei** - followers and new BijbelStudie signups, compared to the week before
- **Volgende week** - what you change and why (one line per change)

## Recipe (per day)

The planner plans one day per run (the day in `content/context/target-week.json`). Every day:

| What | Per day | Slot | Platforms |
|---|---|---|---|
| `verse-still` daily verse | 1 (every day) | 07:00 | instagram, facebook |
| Main reel | 1 | 19:30 | instagram, facebook, tiktok, youtube |
| Extra test reels | 2 | 12:30 and 17:00 | tiktok, youtube |
| Feed post | 1 on Tue, Thu, Sat and Sun only | 12:00 | instagram, facebook |

Over a week that is 7 daily verses, 7 main reels, 14 extras and 4 feed posts. The feed days are also
in the engine (`engine/experiments.mjs` `FEED_DAYS`): change both together. Which formats fill the reel
and feed slots comes from `allocation.json` (`mainReels.format`, `extraReels.format`, `feedPosts.format`;
`feedPosts.slots` is 0 on the other days). Main reels get what works best (the account's face on
Instagram); extra reels on TikTok and YouTube explore more. Ids: `<idPrefix>-<format short>`, with
`-a`/`-b` for the two extras, e.g. `2026-w46-tue-quiz-a` (`idPrefix` already holds the week and the day).

## Formats

- **reel-explainer** - voice over hook + 3-9 lines, verse cards and app screens. See Reel rules.
- **reel-story** - a narrated story with animated scenes: `map` for journeys and places (keys from
  `engine/render/data/places.json`, in route order), `timeline` for a sequence with years (only broadly
  accepted dates; write "ca. 1000 v.Chr." when approximate), `text`, `verse`, `photo`, `stat` (a number
  that counts up: `value` like "12" or "1500+" and a `label`; `text` = small source line; say the number
  in the line), `tree` (a family line of 2-6 `name`s with short `note`s, each appears when its name is
  spoken), `compare` (two cards, `left`/`right` with a `title` and 1-3 short `points`; `text` = optional
  heading) and `word` (a Hebrew or Greek word in its own script with `translit` and a broadly accepted
  `meaning`, optional `verse`; say the word in the line). 5-7 scenes, one per spoken line. Great for
  persons, journeys, periods and "how did we get this book".
- **reel-3d** - a 3D animated film: characters (`cast`, looks from `engine/render/3d/catalog.json`)
  acting in 3D sets (`slaapkamer`, `woonkamer`, `zee`, `woestijn`, `stad`, `heuvels`, and `kaart` = a 3D
  map with a route and a travelling caravan), shot by shot. Each shot is ONE line: the narrator (`say`,
  voice = `voice`) or a character (`by` + `line`, voice = that cast member's `voice`), or a silent `hold`
  of 1-4 s. Per shot: `set`, `time`, `weather` (zee), `camera`, `on`, `actors` (`at` a spot of the set,
  optional `to` = walks there, `do` = action, `mood`, `face`), and optionally `text` (place/time label),
  `verse` (verse card), `app` (the app full size on a phone) or `screen` (what the phone in a hand shows).
  6-12 shots, 25-50 s. `style3d` = the look (see Traits). Kinds of 3D films to make - vary them:
  - **Herkenbare situatie (skit)**: someone today reads the Bible, gets stuck ("wat betekent dit
    eigenlijk?"), asks a friend/parent, who shows how BijbelStudie explains it (phone shot + `app`);
    ends on the benefit. Real, specific confusion from a real verse (old words in the SV, a puzzling
    passage) - the app's answer must be something the app really has (brand/product.md).
  - **Bijbelverhaal**: a Bible story acted out (Jona on the ship, Abraham leaving Haran, David with the
    sheep, Nehemia at the wall) - narrator + one or two character lines that are close to the SV text,
    facts only from the chapter; end with a question or the app (studies on this book/person).
  - **Reis op de kaart**: `kaart` shots for a journey (places in travel order) between story shots.
  - **Wist je dat / mythe vs. tekst**: two characters, one says a common assumption, the other shows what
    the text actually says (verse card); light and friendly.
  Dialog rules: every speaker has a different voice (validator checks); keep lines short and spoken
  (max ~15 words); a character speaks in their own shot (`on` = the speaker for close/medium). Never show
  Jesus or God as a figure (narrate about them instead), no angels as figures, no violence on screen.
  Walking (`to`): only between spots on the same ground - not up to `trap` or `muur` (raised), not between
  the deck and the hold (`ruim`, `ruim-staan` are a separate room below deck). Lying (`ruim`, `bed-liggen`):
  use `wide` or `two-shot`, not `close`.
  Staging for portrait video: put the people of a conversation close to each other (adjacent spots),
  start with a `wide` or `push-in`, use `close` for the key line, `two-shot`/`over-shoulder` for dialog,
  `phone` when the app is shown in a hand.
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
- `style3d` (reel-3d): `lowpoly` (faceted triangles, flat colours), `rond` (smooth toy look), `toon`
  (cartoon, outlines), `blok` (everything blocks), `klei` (claymation). Alex wants many styles tried:
  follow the `style3d` target in allocation.json, and vary it from day to day (`performance.json`).
- `experiment.hook` and `experiment.topic` on every item (`topic`: boek, persoon, context, woord,
  thema, vers, app, praktisch).
- When you repeat a winner, change one thing (another verse, another hook line) - not everything.
- Verses shown in reels and slides: under 230 characters; never one that starts with a heading.

## Experiments (set `experiment` on every item)

- **Formats, looks, voices, music, subtitles, hooks, topics:** divided by `allocation.json` (Thompson
  sampling on fair scores, see `engine/experiments.mjs`). You follow it; you do not pick winners yourself.
- **Feed posts:** `experiment.feedType` = `spotlight`, `statement` or `carousel`.
- **Post times:** fixed per type. The `slot` you write is provisional: when Alex approves an item it
  gets the next free time of its type (verse 07:00, feed post 12:00, extra reels 12:30/17:00, main reel
  19:30; `lib/postingSlots.ts`), so a time test in the spec has no effect - do not plan one.
- **Referral:** once a week, one item promotes "geef een vriend een week Pro cadeau" in its caption: plan it when no item of the target's ISO week has it yet (see `performance.json`).

## Daily verse rules

- Exact words always come from the engine; you only choose `ref` and `photo` (1-365, vary them; calm landscapes).
- Pick verses that stand on their own and comfort, encourage or make you think. Mix well-known and lesser-known.
- Under 260 characters. No verse starting with a heading ("Een psalm van David"), no acrostic letters (Klaagliederen, Psalm 119 headings), no verse that misleads without its context.
- Never a verse from `content/used-verses.json`, never twice in one batch (also not as both still and reel).

## Alex's favourites

Alex likes the animated formats most: `reel-3d` (3D animated films with characters - he asked for
"a lot more" of these and for many different styles), `reel-story` (his favourite are the map stories)
and `reel-kinetic`. `project.json` `experimentPriors` gives them a head start in the allocation (3D the
most), so they get most main slots until the numbers say otherwise; the other formats keep being tested
in the extras. Put your best work into these: real motion in every scene, a strong first second, no
static slides, a story with a turn.

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
