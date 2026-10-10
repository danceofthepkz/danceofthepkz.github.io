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

### Add a paper

Add an object to `publications.items` (order on the page = order in the file):

```json
{
  "title": "Paper title",
  "authors": ["Coauthor One", "Kangze Peng", "Coauthor Two"],
  "venue": "CHI 2027, Yokohama",
  "description": "One sentence on what it shows.",
  "image": null,
  "imageAlt": "",
  "links": [
    { "label": "PDF", "href": "https://…" },
    { "label": "DOI", "href": "https://doi.org/…" }
  ]
}
```

- Your name is bolded automatically when it matches `profile.me` exactly.
- `image`: put a file in `src/assets/` and write `"assets/my-figure.png"` (with an `imageAlt`), or leave `null` for the checkered placeholder.
- A link whose `href` is a `[TODO: …]` renders as greyed text with a TODO marker instead of a dead link.

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
src/fonts/                 self-hosted Spectral (SIL OFL)
src/assets/                favicon, OG image, your images
scripts/build.mjs          JSON + template → dist/
.github/workflows/pages.yml  build + deploy on push to main
```

## Privacy

No analytics, no cookies, no third-party requests: fonts are self-hosted and a Content-Security-Policy restricts everything to this origin. Theme choice is not persisted.
