# Learn - instructions for Claude

Alex reviewed items of one project (the prompt names it) in the studio and wrote comments. `P/` means that
project's folder: `projects/<project>/`. Your only job in this run: make sure no remark of his is lost or
made twice. You plan and write no items.

1. Read `CLAUDE.md` (hard rules), `P/brand/lessons.md` (the rules so far), `P/brand/product.md`,
   `P/brand/voice-and-rules.md`, `P/plan.md` and `engine/spec.mjs` (what a spec can and cannot change).
2. Do step 1b of `planner/PLAN.md` for every entry in `P/content/context/feedback-new.json`: each lasting point
   becomes a rule in `P/brand/lessons.md`; what no spec can fix also goes under "Nog op te lossen in de engine"
   and into `P/content/queue/_engine-feedback.json`.
3. If a remark asks for something only `P/plan.md` can hold (a change to the recipe, formats, voices or icons
   to use), also update `P/plan.md`, short and in the same style. Do not touch code.
4. Alex must not see the same mistake again in what is already made. `P/content/context/pending.json` lists
   the items he has not approved yet (queued or waiting for review). For each one that breaks a rule you just
   added and that a spec can fix (a line, the closing sentence, a voice, an icon, a scene): write the corrected
   spec to `P/content/queue/<same id>.json` - same `id`, `week`, `slot` and `kind`, only what the rule needs
   changed, everything else as it was. Leave items that break no new rule alone. Then run
   `node engine/cli/validate.mjs` and fix every FAIL until it exits 0. (They are made again and come back to
   Te beoordelen; an engine-only rule is handled by the engine fix, which makes them again too.)
   When the prompt says "recheck", check every item in `pending.json` against every rule in `lessons.md`, not
   only the new ones (the rules changed and the items were made before).
5. Then stop. The workflow marks the comments as learned and starts the engine fix when needed.
