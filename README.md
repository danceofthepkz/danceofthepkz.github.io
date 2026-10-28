# danceofthepkz.github.io

Personal academic site: plain HTML/CSS/JS, one content file, a zero-dependency build script, deployed to GitHub Pages by GitHub Actions.

## Editing content

Everything you read on the page lives in **`content/site.json`**. You never need to touch layout code to change text.

Text fields support a little inline formatting:

| Write | Get |
|---|---|
| `[label](https://example.com)` | a link |
| `**bold**` / `*italic*` | bold / italic |
| `[TODO: something]` | a dashed "TODO" marker on the page, listed by the build |

### Add a project (Selected work)

Add an object to `work.items` (order on the page = order in the file):

```json
{
  "slug": "my-project",
  "name": "Short name",
  "title": "Full paper or project title",
  "kinds": ["Build", "Study"],
  "tags": "HCI · Online safety",
  "meta": "CHI 2027",
  "claim": "One sentence on what it is or shows.",
  "authors": ["Coauthor One", "Kangze Peng"],
  "image": "assets/pubs/my-figure.png",
  "imageAlt": "What the figure shows",
  "links": [{ "label": "DOI", "href": "https://doi.org/…" }]
}
```

- `kinds`: `Build` (a system you made) and/or `Study` (experiments, evaluation, modeling).
- `imageFit` (optional): `"contain"` shows the whole image on a white mat instead of cropping it.
- `detail` (optional): adds a case-study page at `/work/<slug>/` with `lead`, `sections` (each `heading` + `paragraphs`, `figure: true` to place the image there), an optional `table`, and `figureCaption`. See the `thesis` entry.
- To list it under Building/Studying at the top, add its `slug` to `approach.items[].projects`.

### Add a position (Experience)

Add `{ "role", "org", "href", "dates", "location", "text", "logo" }` to `experience.items` (newest first). `logo` is a square image in `src/assets/orgs/` (96×96 PNG on white works best); leave it out for a neutral placeholder.

### Add a paper (Publications)

Add `{ "authors": [...], "title": "...", "venue": "...", "links": [...] }` to `publications.items`, or to `publications.working` for work in progress.

- Your name is bolded automatically when it matches `profile.me` exactly.

### Extra pages

`pages` in `site.json` holds simple one-section pages (heading + paragraphs) built to `/<path>/`, sharing the nav and scene. The portfolio placeholder lives there; edit its paragraphs when it is ready, or add another entry for a new page.

### Your photo

Put it at `src/assets/photo.jpg`, then set `"photo": "assets/photo.jpg"` in `profile`.

## Local preview

Requires Node 20+. No `npm install` needed.

```bash
npm run dev        # http://localhost:8000 — rebuilds on every page reload
npm run build      # writes dist/ and lists remaining TODOs
node scripts/build.mjs --strict   # same, but fails if any TODO is left
```

Useful query parameters: `?theme=day|night`, `?companion=light|bird|traveler`.

## Images

```bash
npm run icons      # regenerate favicon.svg / favicon-32.png / apple-touch-icon.png from the grid in scripts/make-icons.mjs
npm run og         # re-render the social preview (src/assets/og-image.png, 1600x840) from the actual scene
```

## Layout

```
content/site.json          all text
src/index.template.html    <head> + page skeleton ({{slots}} filled by the build)
src/styles.css             theme tokens, layout, typography, mobile
src/scene.js               pixel-art canvas scene
src/main.js                boot, theme toggle, pause-when-hidden
src/skylab.js              "Play with the sky" easter egg under the footer (loaded only when opened)
src/assets/                favicon, OG image, your images
scripts/build.mjs          JSON + template → dist/
.github/workflows/pages.yml  build + deploy on push to main
```

## Privacy

No analytics, no cookies, no third-party requests: text uses the visitor's system font and a Content-Security-Policy restricts everything to this origin. Theme choice is not persisted.
