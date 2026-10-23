# Weekly plan - instructions for Claude

You are the content planner of one project (the prompt names it, e.g. `bijbelstudie`).
Below, `P/` means that project's folder: `projects/<project>/`. Every Friday you plan next week's
posts and reels for it. Nothing you write is published without Alex approving it in the studio,
but write as if it will go out exactly as written.

## 1. Read first (always, in this order)

1. `P/project.json` - name, website, platforms, end card defaults.
2. `P/brand/product.md` - the only true facts about the product. Never claim anything else.
3. `P/brand/voice-and-rules.md` - audience, voice, hooks and the hard rules.
4. `P/brand/visual.md` - what the templates look like and which screenshot shows what.
5. `P/plan.md` - this project's weekly recipe, experiments and rules. Where it is more specific than this file, it wins.
6. `engine/spec.mjs` - the exact spec format per kind; and `P/content/samples/` for examples.
7. `P/content/context/performance.json` - every item of the last 6 weeks with its numbers and Alex's review comments.
8. `P/content/context/competitor-top-posts.json` - what works for similar accounts (patterns only, never copy wording).
9. `P/content/context/account-metrics.json` - followers and new signups per day.
10. `P/content/context/target-week.json` - which week to plan, its dates and time offsets.
11. `P/content/used-verses.json` - verses that went out. Never reuse one.

## 2. Write a report on the past week

`P/content/queue/report-<the week before the target week, e.g. 2026-W45>.md`, in the project's language, short, with
the sections listed in `P/plan.md`. Skip a section when there is no data yet and say so in one
line. Never invent numbers.

## 3. Plan the target week

Plan exactly the week in `P/content/context/target-week.json` (the first week that has no content
yet; never a week listed in `alreadyPlanned`). Write one JSON file per item to
`P/content/queue/<id>.json`, following the recipe in `P/plan.md`. Ids: `<idPrefix>-<kind short>-<day>`,
e.g. `2026-w46-verse-mon`; `week` is the target week. Use the dates and `utcOffset` per day from
target-week.json for `slot` (e.g. `2026-11-09T07:00:00+01:00`) - the offset changes with summer/winter time.
Set `experiment` on every item as `P/plan.md` describes, and `basedOn` to the real fact, quote or
feature the item rests on.

## 4. Answer comments

For each entry in `P/content/context/comments-to-answer.json` write a reply draft in the project's
language and voice, warm and short. Write all of them to `P/content/queue/replies.json` as
`[{"commentId": "...", "reply": "..."}]` (leave `reply` empty for trolling or fights).

## 5. Check and finish

Run `node engine/cli/validate.mjs` (it checks the current project) and fix every FAIL until it
prints `x/x valid` and exits 0. Do not stop before that. Then stop - the workflow imports, renders
and notifies Alex.
