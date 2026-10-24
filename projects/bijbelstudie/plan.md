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

The planner plans one day per run (the day in `content/context/target-week.json`). What Alex chose on
24 Oct 2026 (also in `project.json`: `formatsAllowed`, `stylesAllowed`, `style3dAllowed`, `recipe`,
`narratorOnly`; the validator holds you to it):

| What | Per day | Slot (label) | Platforms |
|---|---|---|---|
| `verse-still` daily verse | 1 (every day) | 07:00 | instagram, facebook (never tiktok/youtube) |
| Story reels (`reel-story` or `reel-3d`) | 2 (`recipe.reelsPerDay`) | 19:30 and 19:35 | instagram, facebook, tiktok, youtube (always all four) |

No feed posts, no other formats. Alex approves onto a pile; one reel a day goes out at 19:30 on every
platform and the verse at 07:00 (`engine/slots.mjs`), so the `slot` is only a label. Which of the two
formats fills the reel slots comes from `allocation.json` (`mainReels.format`). Ids: `<idPrefix>-verse`,
`<idPrefix>-story` / `<idPrefix>-film` (`-b` for a second of the same), e.g. `2026-w46-tue-film`.

## Formats (only these; Alex, 24 Oct: "you should not use the other ones anymore")

Every reel tells a Bible story (Alex: "the storytelling videos are going to do the best"), with ONE calm
narrator: `voice` `male`, `female` or `daniel` (the default voices Alex picked, and Daniel from the test set
he asked for), `voiceStyle` `rustig`, no character lines. Alex's feedback on earlier videos is in
`brand/lessons.md` - every rule there applies to every reel. Two that the validator checks:
- The last spoken line ends with "met uitleg, in de BijbelStudie app." - e.g. "Lees het in één Koningen
  zeventien, met uitleg, in de BijbelStudie app."
- Numbered books are said as Alex says them, in words: "één Koningen", "twee Samuël", "één Korinthe".
Names whose stress the voice gets wrong go in `brand/pronunciation.json` (only the voice hears the respelling). Music only `calm`, `reflective` or `cinematic`. Never show Jesus, God or angels as a
figure (narrate about them), no violence on screen (tell it, show the aftermath).

- **reel-story** (`style` `dark` only) - the map story, Alex's favourite: "the style with the map is
  amazing". A narrated story told on a dark relief map of the Bible lands; the map stays on screen the
  whole video (dimmed behind text and verse scenes). Alex found the first ones "too minimalistic", then
  Saulus "a bit too much stuff on the screen - keep it simple, display what is actually useful". So every
  map scene shows something new that explains the story, and nothing that does not:
  - `title` (top-level, max 34): the story's name on a chip at the top ("Jona en de grote vis").
  - per scene `ref`: the passage of that line ("Jona 1:3", "Handelingen 27:14-20"), shown under the title.
  - `places` (keys from `engine/render/data/places.json`, in route order; one place = a pin). With 2+
    places set `travel` (`lopen`, `schip`, `kameel`): a walker/ship/camel rides the route and a chip counts
    the kilometres (as the crow flies) - only when someone really travels that way.
  - `marks`: 1-2 drawn icons beside a place (the validator allows 2), each appearing when its word is spoken
    (`cue`, else the icon's name): `schip`, `storm`, `vis`, `golven`, `ark`, `stad`, `tempel`, `tent`, `berg`,
    `put`, `vuur`, `kroon`, `zwaard`, `schapen`, `licht` (a light from heaven shining down - Saulus; never a
    star for that), `ster` (only a real star), `graan`, `toren`, `rol`, `kruis`. The icon must fit exactly
    what the line says; when none fits, leave it out. `at` = one of the scene's
    places (default the last), `side` (n, ne, e, se, s, sw, w, nw) only when it matters (sea things are put
    on the sea, the rest on land, automatically). Use them for what happens there: a storm and a big fish
    off Joppe, a tent at Bethel, a city at Ninevé, a well at Haran.
  - At least 3 `map` scenes (the validator checks); `verse` and `text` scenes between them are fine; also
    `timeline`, `tree`, `word` when they help. Never `photo` (Alex: a picture that suddenly appears breaks it).
  - 5-7 scenes, one spoken line each, 30-50 s. The map, the routes and the icons carry the story: every
    scene should show something new happening on the map.
- **reel-3d** (`style3d` `stickman` or `getekend` only) - a Bible story as an animated 2D film (drawn by
  `templates/film2d.js`): `cast`, sets (`slaapkamer`, `woonkamer`, `zee`, `woestijn`, `stad`, `heuvels`,
  `kaart` = the map with a route), shot by shot. Each shot is ONE narrator line (`say`) or a silent `hold`
  of 1-4 s. Per shot: `set`, `time`, `weather` (zee), `camera`, `on`, `actors` (`at` a spot, optional `to`
  = walks there, `do`, `mood`, `face`, `holds`, `base`), optionally `text` (place/time label) or `verse`
  (verse card; `say` is then exactly that verse's SV text). 6-12 shots, 30-55 s.
  Alex (24 Oct): details must be right - depth, realism, who does what. So: the world and the action
  carry the film, people small in it (cameras `establish` first, `aerial`, `wide`, `track`, `sky`, `top`,
  `low`; at most one `medium`, no `close`); a silent `hold` of 2 s gives a story room to breathe; at most 4
  people in a film; in a wide shot keep everyone within about 900 units of each other.
  What people can do (2D looks): `do` `carry`/`give`/`help` with `holds` (`kruik`, `steen`, `lam`, `mand`,
  `brood`, `vis`, `buidel`, `olie`), `help` (leans over someone, best kneeling at their head),
  `embrace` (two people close, both with `face`), `bow` (with `base: "kneel"`, room in front), `weep`,
  `raise` (both hands up), `pray`, `point`, `talk`, `sleep`; `mood` `verdrietig` while lying gives half-closed
  eyes; `base: "ride"` = sits on a donkey (with `to` the donkey walks along: "zette hem op zijn eigen
  dier"). Lying (`berm`, `bed-liggen`, `ruim`): `wide`, `top` or `two-shot`.
  Useful spots: `heuvels` `pad-ver` -> `pad-boven` -> `pad` -> `pad-dichtbij` (a walk down the path),
  `berm` (lying by the path) + `berm-naast` (kneeling at his head), `beek` (river), `kudde`; `woestijn`
  `bron` + `bron-2` (a spring among the palms), `verte` (far away, arriving), `kampvuur`, `tent` (also an
  inn). Walking (`to`): only between spots on the same ground - not up to `trap` or `muur`, not between the
  deck and the hold (`ruim`, `ruim-staan`). Pattern for a rescue (Samaritaan): the wounded man at `berm`
  (mood `verdrietig`); the helper `pad-boven` -> `berm-naast`, then `do: "help"`, `holds: "olie"`, `face`
  the man; later the man rides.
  Facts only from the chapter; end with the end card (or the app on that chapter: `web:bijbel/<boek>/<n>`).
  Screens must match what is said: for a Bible chapter the live page `web:bijbel/<boek>/<hoofdstuk>` or
  `web:bijbelboeken/<boek>`; the app screenshots only show what `assets/screenshots/screens.json` says.
- **verse-still** - the daily verse (see Daily verse rules), every day, Instagram and Facebook only.

Not made any more (Alex, 24 Oct): reel-explainer, reel-kinetic, reel-quiz, reel-list, reel-verse,
reel-demo, carousel, post-spotlight, post-statement, reel-story in light/photo, and reel-3d in the 3D looks
(lowpoly, rond, toon, blok, klei, silhouet, papier) and the poster looks (schets, stift, krijt).

## Traits (what each item tests)

- `voice`: `male`, `female` or `daniel` (the default voices and Daniel from the test set; `voices.json` lists
  what exists). One narrator per video. (Alex: when several people speak, test-set voices may join - not used now, `narratorOnly`.)
- `voiceStyle`: `rustig` only (Alex wants calm voices, not sharp ones; project.json `voiceStylesAllowed`). `captions`: `karaoke` (word by
  word), `block` or `none` - for voiced explainers, lists and stories.
- `music`: a mood from `voices.json` `musicMoods` (only those exist), else leave it out.
- `style`: `dark` (reel-story).
- `style3d` (reel-3d): `getekend` (hand-drawn, muted, round-headed figures, handwritten type) or `stickman`
  (flat vector stick figures with black heads, colourful skies, heavy type). Follow the `style3d` target
  in allocation.json and alternate them.
- `experiment.hook` and `experiment.topic` on every item (`topic`: boek, persoon, context, woord,
  thema, vers, app, praktisch).
- When you repeat a winner, change one thing (another verse, another hook line) - not everything.
- Verses shown in reels and slides: under 230 characters; never one that starts with a heading.

## Experiments (set `experiment` on every item)

- **Formats, looks, voices, music, subtitles, hooks, topics:** divided by `allocation.json` (Thompson
  sampling on fair scores, see `engine/experiments.mjs`). You follow it; you do not pick winners yourself.
- **Post times:** none to plan. The `slot` you write is only a label: Alex approves onto a pile and every
  posting time takes the next approved item of its type (verse 07:00, one reel 19:30 on every platform;
  `engine/slots.mjs`), so a time test in the spec has no effect - do not plan one.
- **Referral:** once a week, one item promotes "geef een vriend een week Pro cadeau" in its caption: plan it when no item of the target's ISO week has it yet (see `performance.json`).

## Daily verse rules

- Exact words always come from the engine; you only choose `ref` and `photo` (1-365, vary them; calm landscapes).
- Pick verses that stand on their own and comfort, encourage or make you think. Mix well-known and lesser-known.
- Under 260 characters. No verse starting with a heading ("Een psalm van David"), no acrostic letters (Klaagliederen, Psalm 119 headings), no verse that misleads without its context.
- Never a verse from `content/used-verses.json`, never twice in one batch (also not as both still and reel).

## Alex's favourites

The map story (`reel-story` dark) and the story films in `stickman` and `getekend`. `project.json`
`experimentPriors` gives them a head start; between the two, the numbers decide over time. Put your best
work into every one: real motion in every scene, a strong first second, no static frames, a story with a turn.

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
- Spoken Dutch: short sentences, no brackets, numbers as words. Facts only from the chapter, `brand/product.md`
  or broadly accepted background (author, place, time). No denominational disputes. When you quote scripture,
  show the `verse` (exact SV text); the voice may paraphrase in modern Dutch ("staat er", not a fake quote).
- Every reel ends with the approved end card; set `endCard.headline` to the benefit of that reel (max ~30 chars), `button` "Download gratis".

## Captions (all items)

- Dutch, "je", plain hyphen "-", no emoji spam (zero is fine), no "link in bio".
- End with a clear next step without "zoek ... in de App Store": e.g. "Download BijbelStudie gratis" or "Begin gratis op bijbelstudie.io".
- Hashtags: 3-6, relevant (#bijbel, #bijbelstudie, #bijbellezen, #versvandedag, book or theme tags).
- `basedOn`: the real fact, customer quote or feature the item rests on.

## Comment replies

Warm and short, in the brand voice. Do not answer trolling or theology fights - draft a calm one-liner or leave `reply` empty.
