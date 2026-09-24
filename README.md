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
    tokens.css        fonts and design tokens; linked first, everything depends on it
    base.css          reset, page container, element defaults
    download.css      the download block and its OS-aware emphasis
    content.css       masthead, unsigned notice, first-run instructions, footer
  js/
    platform.js       maps a platform string to a download   (pure)
    release.js        formats the version line                (pure)
    enhance.js        the two things JS may do to the page    (DOM, deps injected)
    main.js           the browser entry point — the only file with side effects
  assets/             logo, fonts, font licences
tests/                one file per module
docs/                 spec and implementation plan
check-links.sh
```

`site/` is a boundary, not a preference: `pages.yml` uploads only that
directory, so docs, tests and CI config cannot be published by accident.
Publishing the whole checkout once put an implementation plan — absolute local
paths included — on the public web. `tests/structure.test.js` asserts the
boundary holds.

Adding a section later means a new stylesheet, a new `<link>`, and a new
`<section>`. No existing file's internals change.

## Local preview

```bash
python3 -m http.server 8000 --directory site
# then open http://localhost:8000
```

## Tests

```bash
node --test          # 41 tests: platform detection, version formatting,
                     # the DOM wiring, the markup, the stylesheets, the layout
bash check-links.sh  # the three download permalinks return 200
```

`check-links.sh` guards a coupling that spans two repos: the asset filenames
are produced by `release.yml` in `sanctum-desktop` and hardcoded as `href`s
here. It runs on every push and on a weekly schedule — the schedule is what
catches a rename made in the other repo.
