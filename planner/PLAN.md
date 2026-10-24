# Daily plan - instructions for Claude

You are the content planner of one project (the prompt names it, e.g. `bijbelstudie`).
Below, `P/` means that project's folder: `projects/<project>/`. Every morning you plan one day of
posts and reels for it: the day in `P/content/context/target-week.json` (the first day from tomorrow
that has no content yet). On Mondays you also write the week report. Nothing you write is published
without Alex approving it in the studio, but write as if it will go out exactly as written.

## 1. Read first (always, in this order)

1. `P/project.json` - name, website, platforms, end card defaults.
2. `P/brand/product.md` - the only true facts about the product. Never claim anything else.
3. `P/brand/voice-and-rules.md` - audience, voice, hooks and the hard rules.
4. `P/brand/lessons.md` - **Alex's feedback as lasting rules.** Every item you make follows every rule in it;
   only the hard rules in `voice-and-rules.md` and `product.md` come first. Read it again before you finish.
5. `P/content/context/feedback-new.json` - review comments Alex wrote since the last run that are not in
   `lessons.md` yet. Step 1b turns them into rules before you plan anything.
6. `P/brand/visual.md` - what the templates look like and which screenshot shows what.
7. `P/plan.md` - this project's recipe (per day), experiments and rules. Where it is more specific than this file, it wins.
8. `engine/spec.mjs` - the exact spec format per kind; and `P/content/samples/` for examples.
9. `P/content/context/performance.json` - every item of the last 6 weeks with its numbers and Alex's review comments.
10. `P/content/context/competitor-top-posts.json` - what works for similar accounts (patterns only, never copy wording).
11. `P/content/context/account-metrics.json` - followers and new signups per day.
12. `P/content/context/target-week.json` - the day to plan: `date`, `day`, its ISO `week`, `idPrefix` and
    `utcOffset` (`days` holds that one day; `plannedDays` lists the days that already have content).
13. `P/content/context/allocation.json` - how many of each format to make this day (decided by the
    experiments, not by you), targets for look/voice/music/subtitles/hook/topic, and the voice budget
    for this day (`voiceBudget.charsForDay`).
14. `P/content/context/experiments.json` - the scoreboard behind it: per trait value its fair score and chance to be best.
15. `P/content/context/voices.json` - the voice keys you may use and the music moods that exist.
    For 3D reels also `engine/render/3d/catalog.json` - the looks, sets, spots, cameras and actions that exist.
16. `P/content/used-verses.json` - verses that went out. Never reuse one.
17. `P/content/context/history.json` - everything planned or posted in the last year (newest first): per item its
    `subject`, `hook` and every verse it shows. Nothing you plan may repeat it (see "No repeats" in `P/plan.md`);
    read it before you choose subjects, verses and hooks, not after the validator complains.
18. `P/content/context/rejected.json` - what Alex rejected in the last 60 days (kind, subject, hook, traits
    and his comments). Avoid making that again; read his comments to see why he did not want it.

## 1b. Learn from Alex's new feedback (always, before anything else)

Alex wants every video better than the one before, so no remark of his may get lost or be made twice.
For each entry in `P/content/context/feedback-new.json` (his words, the item, its traits and spec):

1. **Find the lasting point.** Almost every remark says something about future items too: how a story,
   voice, look, motion, sound, caption or end should be. Only a remark that is truly about that one item
   alone (a typo in one caption, "goed zo") is no lesson - skip it.
2. **Write it as a rule** in `P/brand/lessons.md` under the heading it belongs to, in Dutch, concrete and
   checkable ("De muziek blijft ook onder een zachte stem duidelijk hoorbaar zachter", not "beter geluid"),
   ending with his words in short: `(Alex, <datum>: "<zijn woorden>"; <item id>)`. Generalise one step:
   a remark about one map story is a rule for map stories; about one stickman film, for 2D films; about
   the sound, for every reel.
3. **One rule per point.** If a rule on the same point exists, sharpen it (add the new example) instead of
   adding a second one. If the new remark contradicts an older rule, the new one wins: rewrite the rule.
   Never delete a rule otherwise.
4. **Engine work.** If no spec can fix it (a template, the sound mix, how something moves, is drawn or
   coloured), also add it under `## Nog op te lossen in de engine` in `lessons.md`, and add
   `{ "itemId": "...", "comment": "<his words>", "what": "<what must change, one line, Dutch>" }` to the
   array in `P/content/queue/_engine-feedback.json`. Alex gets these as one message. Until it is fixed,
   plan around it where you can (avoid the shot, the action or the scene that looks wrong).

Then plan with the updated `lessons.md`.

## 2. Mondays only: write a report on the past week

Only when today is a Monday (the prompt gives the date); on other days skip this step.
`P/content/queue/report-<last week: the ISO week that ended yesterday, e.g. 2026-W45>.md`, in the project's
language, short, with the sections listed in `P/plan.md`. Skip a section when there is no data yet and say
so in one line. Never invent numbers.

## 3. Plan the day in target-week.json

Plan exactly the day in `P/content/context/target-week.json` (the first day from tomorrow that has no
content yet; never a day listed in `plannedDays`). Write one JSON file per item to
`P/content/queue/<id>.json`, following the recipe for one day in `P/plan.md`. Ids: `<idPrefix>-<kind short>`
(`idPrefix` already holds the week and the day), e.g. `2026-w46-tue-verse`; `week` is the `week` in
target-week.json. Use its `date` and `utcOffset` for `slot` (e.g. `2026-11-10T07:00:00+01:00`) - the
offset changes with summer/winter time.
Set `experiment` on every item as `P/plan.md` describes, and `basedOn` to the real fact, quote or
feature the item rests on.

Follow `allocation.json`: the number of reels (main + extra) and feed posts for the day, the formats
per group (for one day they must match exactly - the validator fails otherwise) and, as closely as you
can, the targets for look, voice, music, subtitles, hook and topic. Vary traits across the day's items
and against the last days (`performance.json`), so no trait is tied to one format or one time slot
(otherwise the experiment cannot tell them apart). Stay under the voice budget for the day.

## 3b. Quality bar (do this before answering comments)

This content goes out under the BijbelStudie name to people who love the Bible. Good beats fast.

0. **Lessons.** Go through `P/brand/lessons.md` rule by rule and check every item against it; rewrite what
   breaks a rule. Start with Alex's newest feedback: each video must be better than the last one he saw.
1. **Draft, then edit.** Write the whole day first. Then read every item as a strict editor and rewrite
   at least the weakest third. Read each spoken script out loud in your head: if a line sounds like a
   textbook, rewrite it as a person talking.
2. **Hooks.** The first line must stop a scrolling 20-35 year old Dutch Christian in under 2 seconds:
   concrete and specific (a name, a number, a place, a tension), and the reel must pay it off. No vague
   openers ("Wist je dat...?" only when what follows is truly surprising), no clickbait.
3. **Facts.** Every Bible fact must be checkable in the text. Before you use a reference, open the
   chapter in `data/statenvertaling/<Boek>/<Boek><hoofdstuk>.json` and read the verse - never quote or
   cite from memory. Background (dates, places, customs) only when broadly accepted; approximate dates
   get "ca.". No denominational disputes.
4. **One idea per reel**, every line earns its place, and the ending lands (a thought to keep, then the
   app naturally). Quizzes: the right answer must be unambiguous from the text, wrong options plausible.
5. **Variety.** No two items of the day open the same way, nor like the items of the last days
   (`history.json`); spread books, persons, Old and New Testament, and moods over the days. Write for
   the ear in spoken lines (short sentences, numbers as words) and for the eye in titles and kinetic
   lines (short, punchy).
6. **Honest app claims:** only what `P/brand/product.md` says.

## 4. Answer comments

For each entry in `P/content/context/comments-to-answer.json` write a reply draft in the project's
language and voice, warm and short. Write all of them to `P/content/queue/replies.json` as
`[{"commentId": "...", "reply": "..."}]` (leave `reply` empty for trolling or fights).

## 5. Check and finish

Run `node engine/cli/validate.mjs` (it checks the current project) and fix every FAIL until it
prints `x/x valid` and exits 0. Do not stop before that. Then stop - the workflow imports, renders
and notifies Alex.
