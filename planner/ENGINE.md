# Engine fix - instructions for Claude

Alex's feedback that no spec can fix stands in `P/brand/lessons.md` under "Nog op te lossen in de engine"
(`P/` = `projects/<project>/`, the prompt names the project). Your job: fix those items in the engine, so
every next video is better. You work on main as it is now; after you finish, the workflow runs the checks
again, pushes your commit, renders the videos again and tells Alex what changed. There is no review
before it goes live, so be careful: a broken template breaks every video.

1. Read `CLAUDE.md` (hard rules, layout, "Check before you commit"), all of `P/brand/lessons.md` - the open
   items, and "Opgelost in de engine (niet terugdraaien)": never undo one of those - and the code involved
   (`engine/render/render.mjs`, `engine/render/templates/*.js`, `engine/render/stage.html`, `engine/tts/`,
   `engine/spec.mjs`).
2. For each open item: find the cause and make the smallest change that fixes it for every video, not only
   the one Alex commented on. The item names the video (`P/content/imported/*<id>.json` holds its spec).
3. Check your work:
   - `npm run check` must pass.
   - Render stills of the video the item came from, with your change: e.g.
     `node engine/render/render.mjs --stills=1,4.5,12 projects/<project>/content/imported/<file>.json`
     (the output lists where the stills are) and look at them with Read. For motion, take stills close
     together (every 0.2 s) around the moment Alex named. Sound and voice cannot be heard here: reason
     from the code and measure with ffmpeg where you can (volumedetect, silencedetect, astats).
   - When a template changed, also render the project's samples of that format as stills and look.
4. Move each fixed item from "Nog op te lossen in de engine" to "Opgelost in de engine (niet terugdraaien)":
   one line saying what changed and where (file, function). An item you could not fix stays open; write why
   in `ENGINE-FIX.md` (see 5).
5. Write `ENGINE-FIX.md` in the repo root (the workflow sends it to Alex and removes it): in Dutch, short,
   for Alex: per item what he said, what you changed, how you checked it, and anything he should listen or
   look for. No long dashes. And `RERENDER.txt`: the ids of the videos the fixed items came from, one per line
   (the workflow renders them again with the fix; videos waiting for a rewrite are left to the reviser).
6. Commit your changes (`git add <the files you changed> && git commit -m "<what changed>"`) - not
   `ENGINE-FIX.md`, `RERENDER.txt` or `out/`. Do not push, do not touch `.github/`, and change nothing
   outside the engine, `P/brand/` and `P/plan.md`. If you are not sure a change is right, leave the item
   open and say so in `ENGINE-FIX.md` rather than commit a guess.
