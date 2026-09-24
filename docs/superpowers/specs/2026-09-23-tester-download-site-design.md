# Tester Download Site — Design

**Date:** 2026-09-23
**Status:** Approved, ready for implementation planning
**Implements:** Phase 3 WS6 substep 9 (`sanctum/plans/phase-3-desktop-ui.md`), resolving open decision 3

---

## Context

`sanctum-desktop` now produces real, downloadable installers. `v0.1.0-rc.3`
published on 2026-09-23 with six assets, and the version-less permalinks were
verified to return `200` to an unauthenticated request:

```
https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/Sanctum-Desktop-arm64.dmg
https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/Sanctum-Desktop-x86_64.AppImage
https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/sanctum-desktop-amd64.deb
```

Open decision 3 in the phase-3 plan was resolved on 2026-09-03: ship unsigned
builds to developers and testers rather than wait for signing infrastructure.
This site is how those people get the build. It is the last piece between a
working release pipeline and someone actually running the app.

## Goal

Get the right installer onto a tester's machine, get them past their OS's
objection to an unsigned binary, and tell them where to report what breaks.

## Non-goals

- Custom domain (GitHub Pages subdomain is sufficient for now)
- Screenshots or marketing copy — deferred to the "front door" evolution below
- Analytics of any kind
- A Windows download — `build-windows` in `release.yml` is `if: false` until a
  signing certificate exists

---

## Decisions taken

| Question | Decision |
| --- | --- |
| Purpose | Minimal download page now, structured so a product front door can be added later without a rewrite |
| Location | New public repo `sanctum-site`, served by GitHub Pages at `filippotonci.github.io/sanctum-site` |
| Runtime behaviour | Local OS detection **and** a live version number from the GitHub API, both as progressive enhancement |

### Why a separate repo

`sanctum-desktop`'s `ci.yml` has no path filter. A one-line HTML edit there
would trigger the full macOS + Windows + Ubuntu Playwright matrix. Beyond the
waste, the eventual front door describes the whole product — both `sanctum` and
`sanctum-desktop` — so it should not live inside one of them.

---

## Architecture

No build step, no framework, no npm dependencies:

```
sanctum-site/
  index.html
  style.css
  os.js                        # OS detection + version fetch (ES module)
  os.test.js                   # run by `node --test`, zero dependencies
  check-links.sh               # asserts the three permalinks return 200
  assets/sanctum-logo.png
  .github/workflows/pages.yml  # deploy on push to main
  .github/workflows/links.yml  # check-links.sh on push + weekly schedule
```

A static-site generator would be more configuration than content for a single
page, and adds a dependency tree that can rot while the page itself cannot.
`os.js` is a native ES module loaded with `<script type="module">`, so there is
still nothing to compile.

---

## Page structure

Top to bottom:

1. **Header** — logo, "Sanctum Desktop"
2. **One-line description** — what the app does, in a sentence
3. **Unsigned warning** — prominent, not buried
4. **Download block** (`<section id="download">`) — primary button for the
   detected OS, secondary links for the others, Windows shown as unavailable
5. **Version line** — populated by JS, hidden when unavailable
6. **First-run instructions** — per OS, emphasised to match the detected OS
7. **Footer** — links to the desktop repo, its issue tracker, and the `sanctum`
   engine repo

### The seam for the front door

The download block is self-contained. The later front door inserts new sections
*above* `#download` — hero, the local-first argument, screenshots of the review
surface — without modifying it. The eventual page is this page with content
stacked on top, not a rewrite.

---

## Design language

Inherits the app's existing "Editorial Sanctum" system (`src/renderer/src/index.css`)
rather than inventing one:

| Token | Value |
| --- | --- |
| Paper | `#f3ecdd` (light) / dark equivalents under `prefers-color-scheme` |
| Ink | `#1d1813` |
| Accent | `--oxblood: #7c2018` for the primary action |
| Warning tint | `--saffron: #a87317` for the unsigned notice |
| Display | Fraunces |
| Body | IBM Plex Sans |
| Mono | JetBrains Mono (the `xattr` command) |

Fonts load from Google Fonts. The app bundles them locally because of its
airgap invariant; a web page has no such constraint.

Dark mode via `prefers-color-scheme`, using the dark token values the app
already defines.

---

## Progressive enhancement

Roughly 30 lines of dependency-free JavaScript with exactly two jobs.

**OS detection.** Reads `navigator.userAgentData?.platform ?? navigator.platform`,
normalises to `mac` / `linux` / `windows` / unknown, and sets a `data-os`
attribute on `<body>`. CSS handles all reordering and emphasis from that
attribute. JS never constructs DOM.

**Version line.** Fetches `https://api.github.com/repos/FilippoTonci/sanctum-desktop/releases/latest`
and writes e.g. `v0.1.0-rc.3 · released 23 September 2026`. Any failure leaves
the element hidden.

### The load-bearing rule

**Download `href`s are static HTML and are never constructed or rewritten by
JavaScript.** With JS disabled, broken, or rate-limited, every download still
works. JS only reorders and annotates. This is what makes the failure modes
below benign rather than fatal.

---

## Failure modes

| Condition | Result |
| --- | --- |
| JS disabled or throws | All three downloads listed plainly; no version line |
| GitHub API rate-limited (60/hr per IP, unauthenticated) | Version line stays hidden; downloads unaffected |
| OS unrecognised | No primary button; all three presented equally |
| GitHub itself down | Nothing to be done — the assets are hosted there |

---

## Deployment

`.github/workflows/pages.yml`, triggered on push to `main`: upload the
directory as a Pages artifact and deploy it. Repository Pages source set to
"GitHub Actions". No build step, so nothing to cache, pin, or version.

`.github/workflows/links.yml` is separate, because it needs a `schedule`
trigger that has nothing to do with deploying. It runs `node --test` and
`check-links.sh`.

---

## Testing

The visual layer is not the risk. The risk is a **cross-repo coupling with
nothing guarding it**: three filenames are produced by the staging step in
`sanctum-desktop`'s `release.yml` and consumed by hardcoded `href`s in this
repo. Rename one and every download button 404s — silently, with both repos'
CI green.

**`check-links.sh`** — curls all three permalinks unauthenticated and asserts
`200`. Runs in CI on push **and on a weekly schedule**. The scheduled run is
the important one: it catches a break introduced by the *other* repo, which no
push to this one would reveal.

**OS detection** lives in `os.js` as a pure string-to-string function and is
tested by `os.test.js` against representative `navigator.platform` and
`userAgentData.platform` values. Run with `node --test`, which is built into
Node and needs no dependencies — the repo stays npm-free.

**Manual, before first sharing the link:** phone width, JS disabled, dark mode,
and one real download-and-open on macOS.

---

## Future evolution

- **Front door** — marketing sections above `#download`, per the seam above
- **Custom domain** — a `CNAME` file and DNS; no other change
- **Windows** — add a fourth download once `build-windows` is enabled
- **Signed builds** — when macOS notarization lands (issue #2), the unsigned
  warning and the `xattr` instruction come out

---

## References

- Phase 3 plan, WS6 substep 9 and open decision 3 — `sanctum/plans/phase-3-desktop-ui.md`
- Release runbook — `sanctum-desktop/RELEASE.md`
- Asset naming — the "Stage the version-less copies" step in `sanctum-desktop/.github/workflows/release.yml`
- Design tokens — `sanctum-desktop/src/renderer/src/index.css`
