# BijbelQuiz - visual reference for the renderers

Colours and logos come from `project.json` (theme, logos); the templates in
`engine/render/stage.html` use them automatically.

## Logos (in assets/logos/)
- `logo-full.svg` - logo for light grounds (posts)
- `logo-icon-dark.svg` - square mark for dark grounds (end card, verse images)
- `logo-wordmark-white.svg` - name in white for dark grounds
Replace the generated placeholders with the real files (keep the names, or change `logos` in project.json).

## Screenshots (in assets/screenshots/)
PNG app screenshots, named `NN-what-it-shows.png` (e.g. `03-quiz-vraag.png`), status bar cropped.
List here which screen shows what, so the planner picks the right one:

| File | Shows |
|---|---|
| TODO | TODO |

## Photos (in assets/photos/)
Optional: `001.jpg` ... for verse backgrounds. Without them, verse images use the shared `assets/photos/` if present.
