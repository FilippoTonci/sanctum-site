# sanctum-site

The download page for [Sanctum Desktop](https://github.com/FilippoTonci/sanctum-desktop),
served by GitHub Pages at <https://filippotonci.github.io/sanctum-site>.

Static HTML and CSS. No build step, no npm dependencies. What is committed is
what is served.

## Layout

```
site/                 the published root — nothing else reaches the web
  index.html
  styles/
    tokens.css        fonts and the app's "Studio" design tokens; linked first
    base.css          reset, page container, type, buttons
    hero.css          nav, hero, and the animated recreation of the app window
    content.css       trust strip, how it works, screenshots, audience, footer
    download.css      the download block, its OS-aware emphasis, first run
  js/
    platform.js       maps a platform string to a download   (pure)
    release.js        formats the version line                (pure)
    enhance.js        the two things JS may do to the page    (DOM, deps injected)
    main.js           the browser entry point — the only file with side effects
  assets/
    emblem.svg        favicon: the app's wordmark glyph
    shots/            real screenshots of the app, light and dark, WebP
    fonts/            IBM Plex Sans, JetBrains Mono, and their licence
tests/                one file per module
check-links.sh
```

`site/` is a boundary, not a preference: `pages.yml` uploads only that
directory, so tests and CI config cannot be published by accident. Publishing
the whole checkout once put an implementation plan — absolute local paths
included — on the public web. `tests/structure.test.js` asserts the boundary
holds.

The design tokens are copied from `sanctum-desktop/src/renderer/src/index.css`
so the site and the app look the same; fix a token there first, then re-copy.

The screenshots in `assets/shots/` are captures of the real app reviewing
sample documents (public-domain characters, so nothing real is shown). Retake
them when the review UI changes visibly: 1800px wide WebP, one light and one
dark per format, same filenames.

The hero's app window is HTML and CSS, not an image. Its un-animated styles
are the finished frame, so reduced-motion visitors see the end result.

## Local preview

```bash
python3 -m http.server 8000 --directory site
# then open http://localhost:8000
```

## Tests

```bash
node --test          # 45 tests: platform detection, version formatting,
                     # the DOM wiring, the markup, the stylesheets, the layout
bash check-links.sh  # the three download permalinks return 200
```

`check-links.sh` guards a coupling that spans two repos: the asset filenames
are produced by `release.yml` in `sanctum-desktop` and hardcoded as `href`s
here. It runs on every push and on a weekly schedule — the schedule is what
catches a rename made in the other repo.
