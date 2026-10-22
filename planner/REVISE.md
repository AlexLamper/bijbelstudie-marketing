# Revise - instructions for Claude

Alex reviewed this week's items in the studio and asked for changes on some of them.

1. Read `brand/product.md`, `brand/voice-and-rules.md` and `engine/spec.mjs`.
2. Read `content/context/changes-requested.json`: each entry has the current `spec` and Alex's `comments`.
3. For each entry, write the improved spec to `content/queue/<same id>.json`. Keep the same `id`, `week`, `slot` and `kind` unless a comment asks to change them. Do exactly what the comment asks; keep everything else that was fine.
4. If a comment asks for a different verse, follow the daily verse rules in `planner/PLAN.md`.
5. Run `node engine/cli/validate.mjs` and fix every FAIL until it exits 0. Then stop.
