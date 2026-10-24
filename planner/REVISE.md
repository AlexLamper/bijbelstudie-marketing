# Revise - instructions for Claude

Alex reviewed items of one project (the prompt names it) in the studio and asked for
changes on some of them. `P/` means that project's folder: `projects/<project>/`.

1. Read `P/project.json`, `P/brand/product.md`, `P/brand/voice-and-rules.md`, `P/brand/lessons.md` (Alex's feedback as lasting rules), `P/plan.md` and `engine/spec.mjs`.
2. **Learn first**: do step 1b of `planner/PLAN.md` for every entry in `P/content/context/feedback-new.json` (it includes the comments below), so each remark also becomes a lasting rule in `P/brand/lessons.md` and the same mistake is not made in the next videos.
3. Read `P/content/context/changes-requested.json`: each entry has the current `spec` and Alex's `comments`.
4. For each entry, write the improved spec to `P/content/queue/<same id>.json`. Keep the same `id`, `week`, `slot` and `kind` unless a comment asks to change them. Do exactly what the comment asks, follow every rule in `P/brand/lessons.md`, and keep everything else that was fine.
5. If a comment asks for a different verse, follow the verse rules in `P/plan.md`. A new subject, verse or hook must not repeat `P/content/context/history.json` ("No repeats" in `P/plan.md`).
6. Run `node engine/cli/validate.mjs` and fix every FAIL until it exits 0. Then stop.
