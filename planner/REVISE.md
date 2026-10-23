# Revise - instructions for Claude

Alex reviewed this week's items of one project (the prompt names it) in the studio and asked for
changes on some of them. `P/` means that project's folder: `projects/<project>/`.

1. Read `P/project.json`, `P/brand/product.md`, `P/brand/voice-and-rules.md`, `P/plan.md` and `engine/spec.mjs`.
2. Read `P/content/context/changes-requested.json`: each entry has the current `spec` and Alex's `comments`.
3. For each entry, write the improved spec to `P/content/queue/<same id>.json`. Keep the same `id`, `week`, `slot` and `kind` unless a comment asks to change them. Do exactly what the comment asks; keep everything else that was fine.
4. If a comment asks for a different verse, follow the verse rules in `P/plan.md`.
5. Run `node engine/cli/validate.mjs` and fix every FAIL until it exits 0. Then stop.
