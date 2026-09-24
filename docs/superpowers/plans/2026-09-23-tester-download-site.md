# Tester Download Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static one-page site at `filippotonci.github.io/sanctum-site` that gets a tester the right unsigned Sanctum Desktop installer and past their OS's objection to it.

**Architecture:** Plain HTML + CSS with no build step and no npm dependencies. Download `href`s are static markup that JavaScript never touches; a native ES module adds OS-aware ordering and a live version number as pure enhancement. A scheduled CI job curls the links the page actually contains, guarding a cross-repo coupling that nothing else checks.

**Tech Stack:** HTML5, CSS custom properties, native ES modules, `node --test` (Node 20, built in — no test framework), bash + curl, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-23-tester-download-site-design.md`

## Global Constraints

- **No npm.** No `package.json`, no `node_modules`, no lockfile. Tests run under `node --test`, which is built into Node 20.
- **No build step.** What is committed is what is served.
- **Download `href`s are static HTML and are never constructed, rewritten, or removed by JavaScript.** This is the rule that makes every failure mode below benign.
- **Node 20** (`v20.20.2` confirmed locally; CI pins `node-version: 20`).
- **Three asset filenames, exact:** `Sanctum-Desktop-arm64.dmg`, `Sanctum-Desktop-x86_64.AppImage`, `sanctum-desktop-amd64.deb`. Produced by the "Stage the version-less copies" step in `sanctum-desktop/.github/workflows/release.yml`.
- **Permalink base, exact:** `https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/`
- **macOS is Apple Silicon only.** No Intel build exists. Copy must say so wherever the `.dmg` is offered.
- **No Windows download.** `build-windows` in `release.yml` is `if: false`. Windows is shown as unavailable, never linked.
- **Design tokens are copied verbatim** from `sanctum-desktop/src/renderer/src/index.css`. Do not invent values.
- **No analytics, no trackers, no cookies.**

## Review Focus

Five conditions the spec implies that no task's happy path would catch. Each has a test in the task that owns the code.

1. **A tester opens the link on an iPad or iPhone.** `navigator.platform` returns `MacIntel` on iPadOS, so naive detection offers a `.dmg` to a device that cannot run one. Expect: treated as unknown, no primary button. — Task 1
2. **An Intel Mac visitor.** The only `.dmg` is arm64; no API can tell you the Mac's architecture. Expect: the label says "Apple Silicon" so the visitor can tell before a 187 MB download. — Task 2
3. **GitHub's API is rate-limited (60/hr per IP, unauthenticated) or offline.** Expect: the version line stays hidden. It must never render `undefined`, `NaN`, or `Invalid Date`. — Task 4
4. **JavaScript is disabled, blocked, or throws partway through.** Expect: all three downloads present and working, because the `href`s were never JS's to own. — Task 3
5. **An unrecognised platform** (BSD, a bot, a stripped user agent). Expect: no primary button, all three downloads presented equally rather than the page appearing broken. — Task 1 and Task 3

---

### Task 1: Repo scaffold and OS detection

**Files:**
- Create: `/Users/filippo/Desktop/sanctum-site/.gitignore`
- Create: `/Users/filippo/Desktop/sanctum-site/README.md`
- Create: `/Users/filippo/Desktop/sanctum-site/os.js`
- Test: `/Users/filippo/Desktop/sanctum-site/os.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `detectOs(platform, options) -> 'mac' | 'linux' | 'windows' | 'unknown'`, exported from `os.js`. `platform` is a string; `options` is `{ maxTouchPoints?: number }`. Task 3 imports it.

- [ ] **Step 1: Initialise the repo**

The directory already exists and holds only `docs/` and `.DS_Store`.

```bash
cd /Users/filippo/Desktop/sanctum-site
git init
git branch -M main
```

- [ ] **Step 2: Write `.gitignore`**

```
.DS_Store
```

- [ ] **Step 3: Write `README.md`**

```markdown
# sanctum-site

The download page for [Sanctum Desktop](https://github.com/FilippoTonci/sanctum-desktop),
served by GitHub Pages at <https://filippotonci.github.io/sanctum-site>.

Static HTML and CSS. No build step, no npm dependencies. What is committed is
what is served.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

```bash
node --test        # OS detection and version formatting
bash check-links.sh  # the three download permalinks return 200
```

`check-links.sh` guards a coupling that spans two repos: the asset filenames
are produced by `release.yml` in `sanctum-desktop` and hardcoded as `href`s
here. It runs on every push and on a weekly schedule — the schedule is what
catches a rename made in the other repo.
```

- [ ] **Step 4: Write the failing test**

`os.test.js`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectOs } from './os.js'

test('detects macOS from navigator.platform', () => {
  assert.equal(detectOs('MacIntel'), 'mac')
})

test('detects macOS from userAgentData.platform', () => {
  assert.equal(detectOs('macOS'), 'mac')
})

test('detects Windows', () => {
  assert.equal(detectOs('Win32'), 'windows')
  assert.equal(detectOs('Windows'), 'windows')
})

test('detects Linux', () => {
  assert.equal(detectOs('Linux x86_64'), 'linux')
  assert.equal(detectOs('Linux'), 'linux')
})

// Review Focus 1: iPadOS reports "MacIntel". A tablet cannot run a .dmg, and
// the touch-point count is the only signal that separates it from a real Mac.
test('treats a touch "MacIntel" device as unknown, not mac', () => {
  assert.equal(detectOs('MacIntel', { maxTouchPoints: 5 }), 'unknown')
})

test('a real Mac has no touch points and is still mac', () => {
  assert.equal(detectOs('MacIntel', { maxTouchPoints: 0 }), 'mac')
})

test('treats phones and tablets as unknown', () => {
  for (const p of ['iPhone', 'iPad', 'iPod touch', 'Android', 'Linux armv8l']) {
    assert.equal(detectOs(p), 'unknown', `${p} should be unknown`)
  }
})

// "Darwin" contains the substring "win". Order of matching is load-bearing.
test('does not mistake Darwin for Windows', () => {
  assert.equal(detectOs('Darwin'), 'mac')
})

// Review Focus 5: anything unrecognised must be reported as such, so the page
// falls back to presenting all downloads equally.
test('returns unknown for junk, empty, and missing input', () => {
  for (const p of ['FreeBSD', '', '   ', undefined, null, 42, {}]) {
    assert.equal(detectOs(p), 'unknown')
  }
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd /Users/filippo/Desktop/sanctum-site && node --test`

Expected: FAIL — `Cannot find module './os.js'`.

- [ ] **Step 6: Write the implementation**

`os.js`:

```javascript
// Maps a platform string to the download we should promote.
//
// Two sources feed this: `navigator.userAgentData.platform` ("macOS",
// "Windows", "Linux") where available, and the older `navigator.platform`
// ("MacIntel", "Win32", "Linux x86_64") everywhere else. Both go through here.

// Checked in order. Mac precedes Windows deliberately: "Darwin" contains the
// substring "win", so a /win/ test would claim it first.
const PATTERNS = [
  [/mac|darwin/i, 'mac'],
  [/win/i, 'windows'],
  [/linux|x11|cros/i, 'linux'],
]

// Mobile and tablet platforms. None of the three builds runs on these, so they
// are unknown rather than wrong. "Linux armv8l" is Android reporting itself
// through the legacy field, and would otherwise match the Linux pattern and be
// offered an x86_64 AppImage.
const HANDHELD = /iphone|ipad|ipod|android|linux arm/i

export function detectOs(platform, { maxTouchPoints = 0 } = {}) {
  if (typeof platform !== 'string' || platform.trim() === '') return 'unknown'
  if (HANDHELD.test(platform)) return 'unknown'

  // iPadOS 13+ reports "MacIntel" and is indistinguishable from a desktop Mac
  // except by touch points. A Mac with a touchscreen does not exist; an iPad
  // pretending to be one does. Treat touch + Mac as a tablet.
  if (/mac/i.test(platform) && maxTouchPoints > 1) return 'unknown'

  for (const [pattern, name] of PATTERNS) {
    if (pattern.test(platform)) return name
  }
  return 'unknown'
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node --test`

Expected: PASS, 9 tests.

- [ ] **Step 8: Commit**

```bash
git add .gitignore README.md os.js os.test.js docs/
git commit -m "Detect the visitor's OS, and refuse to guess wrong"
```

---

### Task 2: The page itself, working with JavaScript disabled

**Files:**
- Create: `/Users/filippo/Desktop/sanctum-site/index.html`
- Create: `/Users/filippo/Desktop/sanctum-site/style.css`
- Create: `/Users/filippo/Desktop/sanctum-site/assets/sanctum-logo.png`
- Test: `/Users/filippo/Desktop/sanctum-site/page.test.js`

**Interfaces:**
- Consumes: nothing. This task must not reference `os.js` — the page has to stand up without it.
- Produces: the DOM contract Task 3 and Task 4 attach to — `<body>` (receives `data-os`), `#download`, `.dl` links each carrying `data-platform` of `mac` / `linux` / `windows`, and `#version` (present, `hidden`).

- [ ] **Step 1: Prepare the logo asset**

The source is 796×650 and 770 KB, which is far too heavy for a single-page site. Downscale and strip metadata with `sips`, which ships with macOS:

```bash
cd /Users/filippo/Desktop/sanctum-site
mkdir -p assets
sips -Z 560 /Users/filippo/Desktop/sanctum-desktop/img/SanctumLogo.png \
  --out assets/sanctum-logo.png
ls -lh assets/sanctum-logo.png
```

Expected: well under 200 KB. If it is larger, re-run with `-Z 400`.

- [ ] **Step 2: Write the failing test**

`page.test.js` — a string-level test of the served markup. No DOM library, so the repo stays dependency-free.

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')

const BASE = 'https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download'
const ASSETS = {
  mac: 'Sanctum-Desktop-arm64.dmg',
  linux: 'Sanctum-Desktop-x86_64.AppImage',
  deb: 'sanctum-desktop-amd64.deb',
}

// Review Focus 4: the hrefs must be complete in the markup, because JS is
// never allowed to build them. If these are absent from the HTML, a visitor
// without working JS has no way to download anything.
test('every download href is a complete static URL in the markup', () => {
  for (const asset of Object.values(ASSETS)) {
    assert.ok(html.includes(`${BASE}/${asset}`), `missing static href for ${asset}`)
  }
})

test('no download href is left for JavaScript to fill in', () => {
  assert.ok(!/href=["'](#|javascript:|)["']/.test(html), 'found a placeholder href')
})

// Review Focus 2: no API reveals a Mac's architecture, so the only protection
// against an Intel user downloading 187 MB that will not run is saying so.
test('the macOS download states it is Apple Silicon only', () => {
  const macLink = html.match(/<a[^>]*data-platform="mac"[\s\S]*?<\/a>/)
  assert.ok(macLink, 'no mac download link found')
  assert.match(macLink[0], /Apple Silicon/i)
})

test('Windows is shown as unavailable and is not a link', () => {
  assert.match(html, /Windows/)
  assert.ok(
    !/<a[^>]*data-platform="windows"/.test(html),
    'Windows must not be a download link until build-windows is enabled',
  )
})

test('the unsigned warning and the unblock command are both present', () => {
  assert.match(html, /unsigned/i)
  assert.match(html, /xattr -dr com\.apple\.quarantine/)
})

test('the version line exists and starts hidden', () => {
  const version = html.match(/<[^>]*id="version"[^>]*>/)
  assert.ok(version, 'no #version element')
  assert.match(version[0], /\bhidden\b/, '#version must start hidden')
})

test('declares a language and a viewport', () => {
  assert.match(html, /<html[^>]+lang="en"/)
  assert.match(html, /name="viewport"/)
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test`

Expected: FAIL — `ENOENT` for `index.html`.

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sanctum Desktop — Download</title>
    <meta
      name="description"
      content="Drag in a document. Review the detections. Export a clean copy. All on your machine."
    />
    <link rel="icon" href="assets/sanctum-logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="style.css" />
    <script type="module" src="os.js"></script>
  </head>

  <body>
    <main>
      <header class="masthead">
        <img class="logo" src="assets/sanctum-logo.png" alt="" width="280" />
        <h1>Sanctum Desktop</h1>
        <p class="tagline">
          Drag in a document. Review the detections. Export a clean copy.
          All on your machine.
        </p>
      </header>

      <aside class="notice" role="note">
        <h2>These builds are unsigned</h2>
        <p>
          Sanctum Desktop is pre-alpha and not yet code-signed or notarized.
          Your operating system will object the first time you open it — that
          is expected, and the instructions below get you past it. These
          builds are for developers and testers, not for handling real
          confidential documents yet.
        </p>
      </aside>

      <section id="download">
        <h2>Download</h2>

        <ul class="downloads">
          <li class="dl-item" data-for="mac">
            <a
              class="dl"
              data-platform="mac"
              href="https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/Sanctum-Desktop-arm64.dmg"
            >
              <span class="dl-os">macOS</span>
              <span class="dl-meta">Apple Silicon · .dmg</span>
            </a>
          </li>

          <li class="dl-item" data-for="linux">
            <a
              class="dl"
              data-platform="linux"
              href="https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/Sanctum-Desktop-x86_64.AppImage"
            >
              <span class="dl-os">Linux</span>
              <span class="dl-meta">x86_64 · AppImage</span>
            </a>
          </li>

          <li class="dl-item" data-for="linux">
            <a
              class="dl"
              data-platform="linux"
              href="https://github.com/FilippoTonci/sanctum-desktop/releases/latest/download/sanctum-desktop-amd64.deb"
            >
              <span class="dl-os">Debian / Ubuntu</span>
              <span class="dl-meta">amd64 · .deb</span>
            </a>
          </li>

          <li class="dl-item dl-unavailable" data-for="windows">
            <span class="dl">
              <span class="dl-os">Windows</span>
              <span class="dl-meta">Not available yet</span>
            </span>
          </li>
        </ul>

        <p id="version" class="version" hidden></p>
      </section>

      <section class="first-run">
        <h2>First run</h2>

        <article class="instructions" data-for="mac">
          <h3>macOS</h3>
          <p>
            macOS will say the app is damaged or cannot be verified. It is not
            damaged — it is unsigned, and the download carries a quarantine
            flag. Drag the app to Applications, then run:
          </p>
          <pre><code>xattr -dr com.apple.quarantine "/Applications/Sanctum Desktop.app"</code></pre>
          <p>Only Apple Silicon Macs are supported. There is no Intel build.</p>
        </article>

        <article class="instructions" data-for="linux">
          <h3>Linux</h3>
          <p>The AppImage needs to be made executable before it will run:</p>
          <pre><code>chmod +x Sanctum-Desktop-x86_64.AppImage
./Sanctum-Desktop-x86_64.AppImage</code></pre>
          <p>
            If it fails on missing FUSE, install the <code>.deb</code> instead,
            or extract the AppImage with
            <code>--appimage-extract</code>.
          </p>
        </article>

        <article class="instructions" data-for="windows">
          <h3>Windows</h3>
          <p>
            No Windows build yet — code signing is still being arranged.
            Without it, SmartScreen blocks the installer outright rather than
            merely warning about it.
          </p>
        </article>
      </section>

      <section class="reporting">
        <h2>Something broke</h2>
        <p>
          Expected, at this stage — please say so. Open an issue on the
          <a href="https://github.com/FilippoTonci/sanctum-desktop/issues"
            >desktop repo</a
          >
          with your OS and what you were doing.
        </p>
      </section>

      <footer>
        <a href="https://github.com/FilippoTonci/sanctum-desktop"
          >sanctum-desktop</a
        >
        <a href="https://github.com/FilippoTonci/sanctum">sanctum engine</a>
        <a href="https://github.com/FilippoTonci/sanctum-desktop/releases"
          >all releases</a
        >
      </footer>
    </main>
  </body>
</html>
```

- [ ] **Step 5: Write `style.css`**

Token values copied verbatim from `sanctum-desktop/src/renderer/src/index.css`.

```css
:root {
  color-scheme: light dark;

  --paper: #f3ecdd;
  --paper-elevated: #fbf6ea;
  --paper-sunken: #ebe2cf;
  --ink: #1d1813;
  --ink-soft: #3c3429;
  --ink-muted: #766b5b;
  --hairline: rgba(29, 24, 19, 0.16);
  --oxblood: #7c2018;
  --oxblood-hover: #5e160f;
  --saffron: #a87317;
  --saffron-soft: rgba(168, 115, 23, 0.16);

  --font-display: 'Fraunces', 'Iowan Old Style', 'Hoefler Text', serif;
  --font-body: 'IBM Plex Sans', 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;

  --radius-md: 6px;
  --radius-lg: 10px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1a1612;
    --paper-elevated: #221c16;
    --paper-sunken: #14110d;
    --ink: #ece2cb;
    --ink-soft: #c8bca1;
    --ink-muted: #968a72;
    --hairline: rgba(236, 226, 203, 0.14);
    --oxblood: #d96a5d;
    --oxblood-hover: #e88679;
    --saffron: #d9a854;
    --saffron-soft: rgba(217, 168, 84, 0.18);
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}

main {
  max-width: 44rem;
  /* 16px side gutter at phone width. */
  margin: 0 auto;
  padding: 4rem 1rem 6rem;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 0.5rem;
}

h1 {
  font-size: clamp(2rem, 7vw, 3rem);
  font-variation-settings: 'opsz' 144, 'SOFT' 30, 'WONK' 0;
}

h2 {
  font-size: 1.35rem;
}

h3 {
  font-size: 1.05rem;
}

code,
pre {
  font-family: var(--font-mono);
  font-size: 0.875rem;
}

pre {
  background: var(--paper-sunken);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  /* Long commands scroll rather than widening the page on a phone. */
  overflow-x: auto;
}

a {
  color: var(--oxblood);
}

/* ---- Masthead ---- */

.masthead {
  text-align: center;
  margin-bottom: 3rem;
}

.logo {
  max-width: min(280px, 60vw);
  height: auto;
}

.tagline {
  font-size: 1.1rem;
  color: var(--ink-soft);
  margin: 0.5rem 0 0;
}

/* ---- Unsigned notice ---- */

.notice {
  background: var(--saffron-soft);
  border-left: 3px solid var(--saffron);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  margin-bottom: 3rem;
}

.notice h2 {
  font-size: 1.1rem;
}

.notice p {
  margin: 0;
  color: var(--ink-soft);
}

/* ---- Downloads ---- */

.downloads {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dl {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.9rem 1.15rem;
  background: var(--paper-elevated);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: var(--ink);
}

a.dl:hover {
  border-color: var(--oxblood);
}

.dl-os {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
}

.dl-meta {
  font-size: 0.875rem;
  color: var(--ink-muted);
}

.dl-unavailable .dl {
  opacity: 0.55;
  cursor: not-allowed;
}

.version {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  color: var(--ink-muted);
  text-align: center;
}

/* ---- OS-aware emphasis ----
   Driven entirely by the data-os attribute that os.js sets on <body>. With no
   JS the attribute is absent, every selector below misses, and the page renders
   in document order with all downloads weighted equally — which is a correct
   page, not a degraded one. */

body[data-os='mac'] .dl-item[data-for='mac'],
body[data-os='linux'] .dl-item[data-for='linux'] {
  order: -1;
}

body[data-os='mac'] .dl-item[data-for='mac'] a.dl,
body[data-os='linux'] .dl-item[data-for='linux'] a.dl {
  background: var(--oxblood);
  border-color: var(--oxblood);
  color: var(--paper-elevated);
}

body[data-os='mac'] .dl-item[data-for='mac'] a.dl:hover,
body[data-os='linux'] .dl-item[data-for='linux'] a.dl:hover {
  background: var(--oxblood-hover);
}

body[data-os='mac'] .dl-item[data-for='mac'] .dl-meta,
body[data-os='linux'] .dl-item[data-for='linux'] .dl-meta {
  color: var(--paper-sunken);
}

/* ---- First-run instructions ---- */

.first-run,
.reporting {
  margin-top: 3rem;
}

.instructions {
  border-top: 1px solid var(--hairline);
  padding-top: 1.25rem;
  margin-top: 1.25rem;
}

.instructions p {
  color: var(--ink-soft);
}

body[data-os='mac'] .instructions[data-for='mac'],
body[data-os='linux'] .instructions[data-for='linux'] {
  order: -1;
}

/* Non-matching instructions stay on the page — a tester may be downloading for
   a different machine — but recede. */
body[data-os='mac'] .instructions:not([data-for='mac']),
body[data-os='linux'] .instructions:not([data-for='linux']),
body[data-os='windows'] .instructions:not([data-for='windows']) {
  opacity: 0.6;
}

.first-run {
  display: flex;
  flex-direction: column;
}

.first-run > h2 {
  order: -2;
}

/* ---- Footer ---- */

footer {
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--hairline);
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  font-size: 0.875rem;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test`

Expected: PASS — 9 tests from Task 1 plus 7 here, 16 total.

- [ ] **Step 7: Look at it with JavaScript disabled**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`, disable JavaScript in devtools, and reload. Confirm: all three downloads present and clickable, no primary highlight, no version line, no layout collapse. This is the state Review Focus 4 protects, and it is the only step here a test cannot judge.

- [ ] **Step 8: Commit**

```bash
git add index.html style.css page.test.js assets/
git commit -m "Serve the download page without asking for JavaScript"
```

---

### Task 3: OS-aware ordering as pure enhancement

**Files:**
- Modify: `/Users/filippo/Desktop/sanctum-site/os.js`
- Modify: `/Users/filippo/Desktop/sanctum-site/os.test.js`

**Interfaces:**
- Consumes: `detectOs` from Task 1; the `data-for` attributes and `#download` markup from Task 2.
- Produces: `readPlatform(navigatorLike) -> string`, exported from `os.js`. Task 4 does not use it, but the whole-file import in `os.test.js` does.

- [ ] **Step 1: Write the failing test**

Append to `os.test.js`:

```javascript
import { readPlatform } from './os.js'

test('prefers userAgentData.platform when present', () => {
  const nav = { userAgentData: { platform: 'macOS' }, platform: 'MacIntel' }
  assert.equal(readPlatform(nav), 'macOS')
})

test('falls back to navigator.platform', () => {
  assert.equal(readPlatform({ platform: 'Win32' }), 'Win32')
})

// Review Focus 4: a navigator missing both fields must not throw. A thrown
// module-level error would abort the script, and anything it was going to do
// later would silently not happen.
test('survives a navigator with neither field', () => {
  assert.equal(readPlatform({}), '')
  assert.equal(readPlatform(undefined), '')
})

// Review Focus 5 at the wiring level: an unknown platform must still produce a
// usable attribute value rather than "undefined".
test('an unrecognised navigator resolves to the unknown bucket', () => {
  assert.equal(detectOs(readPlatform({ platform: 'FreeBSD' })), 'unknown')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`

Expected: FAIL — `readPlatform` is not exported.

- [ ] **Step 3: Extend `os.js`**

Append:

```javascript
export function readPlatform(navigatorLike) {
  if (!navigatorLike || typeof navigatorLike !== 'object') return ''
  const modern = navigatorLike.userAgentData?.platform
  if (typeof modern === 'string' && modern !== '') return modern
  const legacy = navigatorLike.platform
  return typeof legacy === 'string' ? legacy : ''
}

// --- Wiring -----------------------------------------------------------------
// Everything above is pure and tested. Everything below touches the document
// and runs only in a browser.
//
// This sets one attribute. It does not create elements, and it does not touch
// a single href — CSS does all the reordering and emphasis from `data-os`.
// That division is why a failure here costs the visitor a highlight rather
// than a download.

function applyOs(doc, navigatorLike) {
  const os = detectOs(readPlatform(navigatorLike), {
    maxTouchPoints: navigatorLike?.maxTouchPoints ?? 0,
  })
  if (os !== 'unknown') doc.body.dataset.os = os
}

if (typeof document !== 'undefined') {
  try {
    applyOs(document, navigator)
  } catch {
    // Leaves the page in its no-JS state, which is fully functional.
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test`

Expected: PASS, 20 tests. The `typeof document !== 'undefined'` guard is what lets this file be imported by the test runner without a DOM.

- [ ] **Step 5: Verify in a browser**

With `python3 -m http.server 8000` running, open the page and confirm in devtools that `<body>` has `data-os="mac"`, that the macOS download is first and oxblood, and that its `href` is byte-identical to the one in the markup. Then in the console:

```javascript
document.querySelectorAll('.dl[data-platform]').forEach((a) => console.log(a.href))
```

Expected: three complete `releases/latest/download/...` URLs. If JS had rewritten them, this is where it would show.

- [ ] **Step 6: Commit**

```bash
git add os.js os.test.js
git commit -m "Put the visitor's own download first, without owning the link"
```

---

### Task 4: The live version line

**Files:**
- Modify: `/Users/filippo/Desktop/sanctum-site/os.js`
- Modify: `/Users/filippo/Desktop/sanctum-site/os.test.js`

**Interfaces:**
- Consumes: the `#version` element from Task 2, which is present and `hidden`.
- Produces: `formatVersion(release) -> string | null`, exported from `os.js`.

- [ ] **Step 1: Write the failing test**

Append to `os.test.js`:

```javascript
import { formatVersion } from './os.js'

test('formats a release into a version line', () => {
  const line = formatVersion({
    tag_name: 'v0.1.0-rc.3',
    published_at: '2026-09-23T18:59:17Z',
  })
  assert.equal(line, 'v0.1.0-rc.3 · released 23 September 2026')
})

// Review Focus 3: every one of these is what the GitHub API actually returns
// when rate-limited, when the repo has no release, or when it errors. None may
// produce a line containing "undefined", "NaN", or "Invalid Date".
test('returns null rather than a broken line for unusable input', () => {
  const unusable = [
    undefined,
    null,
    {},
    { message: "API rate limit exceeded for 1.2.3.4" },
    { tag_name: '' },
    { tag_name: null, published_at: '2026-09-23T18:59:17Z' },
  ]
  for (const release of unusable) {
    assert.equal(formatVersion(release), null, `should reject ${JSON.stringify(release)}`)
  }
})

test('falls back to the tag alone when the date is unusable', () => {
  for (const published of [undefined, '', 'not-a-date']) {
    assert.equal(
      formatVersion({ tag_name: 'v0.1.0-rc.3', published_at: published }),
      'v0.1.0-rc.3',
    )
  }
})

test('never emits undefined, NaN, or Invalid Date', () => {
  const inputs = [
    { tag_name: 'v1.0.0' },
    { tag_name: 'v1.0.0', published_at: 'garbage' },
    { tag_name: 'v1.0.0', published_at: '2026-09-23T18:59:17Z' },
  ]
  for (const release of inputs) {
    const line = formatVersion(release)
    assert.doesNotMatch(line, /undefined|NaN|Invalid Date/)
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test`

Expected: FAIL — `formatVersion` is not exported.

- [ ] **Step 3: Extend `os.js`**

Insert `formatVersion` above the wiring section, then extend the wiring:

```javascript
const RELEASES_API =
  'https://api.github.com/repos/FilippoTonci/sanctum-desktop/releases/latest'

// The permalink filenames deliberately carry no version, so this line is the
// only way a tester can tell which build they just downloaded.
export function formatVersion(release) {
  const tag = release?.tag_name
  if (typeof tag !== 'string' || tag === '') return null

  const published = new Date(release?.published_at ?? NaN)
  if (Number.isNaN(published.getTime())) return tag

  const when = published.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${tag} · released ${when}`
}
```

Then append to the wiring section:

```javascript
// Unauthenticated GitHub API calls are capped at 60/hour per IP. Past that it
// returns 403 with a JSON body that has no tag_name. Every failure path here
// ends the same way: the element stays hidden and nothing else is touched.
async function applyVersion(doc, fetchImpl) {
  const el = doc.getElementById('version')
  if (!el) return
  const response = await fetchImpl(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return
  const line = formatVersion(await response.json())
  if (line === null) return
  el.textContent = line
  el.hidden = false
}
```

and extend the browser-only block to:

```javascript
if (typeof document !== 'undefined') {
  try {
    applyOs(document, navigator)
  } catch {
    // Leaves the page in its no-JS state, which is fully functional.
  }
  // Deliberately not awaited: the version line is the last thing that matters
  // on this page, and a hung request must not delay anything.
  applyVersion(document, fetch).catch(() => {
    // Rate-limited, offline, or blocked. The line stays hidden.
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test`

Expected: PASS, 24 tests.

- [ ] **Step 5: Verify both paths in a browser**

Reload the page: the version line should read `v0.1.0-rc.3 · released 23 September 2026`.

Then force the failure path — in devtools, block `api.github.com` (Network → request blocking) and reload. Confirm the version line is absent and all three downloads still work. This is Review Focus 3 as a visitor would meet it.

- [ ] **Step 6: Commit**

```bash
git add os.js os.test.js
git commit -m "Tell testers which build they are getting"
```

---

### Task 5: Guard the cross-repo filename coupling

**Files:**
- Create: `/Users/filippo/Desktop/sanctum-site/check-links.sh`
- Create: `/Users/filippo/Desktop/sanctum-site/.github/workflows/links.yml`

**Interfaces:**
- Consumes: the `href`s in `index.html` from Task 2 — it reads them out of the file rather than keeping its own copy.
- Produces: nothing other tasks consume.

This is the task that addresses the spec's stated real risk. Three filenames are produced by `release.yml` in `sanctum-desktop` and hardcoded here, with nothing connecting the two repos. A rename there 404s every button here, silently, with both repos' CI green.

- [ ] **Step 1: Write `check-links.sh`**

It extracts the URLs from `index.html` instead of listing them. A second hardcoded list would be one more thing to forget to update — and it would pass while the page was broken.

```bash
#!/usr/bin/env bash
# Assert that every download link in index.html actually resolves.
#
# The filenames come from the "Stage the version-less copies" step in
# sanctum-desktop/.github/workflows/release.yml. Nothing in either repo's
# type system or CI connects the two. This script is that connection, and the
# weekly schedule in links.yml is what makes it catch a change made over
# there — no push here would.
#
# Reads the URLs out of index.html on purpose: a hardcoded list in this file
# could pass while the page 404s.
set -euo pipefail

cd "$(dirname "$0")"

# `while read` rather than `mapfile`: macOS ships bash 3.2, where mapfile does
# not exist. Verified — it fails there with "mapfile: command not found" and,
# worse, the empty array then reports as "no URLs found in index.html", which
# points at the wrong file. Process substitution works in 3.2.
urls=()
while IFS= read -r url; do
  urls+=("$url")
done < <(
  grep -oE 'https://github\.com/FilippoTonci/sanctum-desktop/releases/latest/download/[A-Za-z0-9._-]+' index.html |
    sort -u
)

if [ "${#urls[@]}" -eq 0 ]; then
  echo "FAIL: no download URLs found in index.html." >&2
  echo "      Either the links were removed or the URL shape changed." >&2
  exit 1
fi

# Guards against a link silently disappearing: macOS dmg, Linux AppImage, deb.
if [ "${#urls[@]}" -ne 3 ]; then
  printf 'FAIL: expected 3 distinct download URLs in index.html, found %d:\n' "${#urls[@]}" >&2
  printf '      %s\n' "${urls[@]}" >&2
  exit 1
fi

failed=0
for url in "${urls[@]}"; do
  # -L because /releases/latest/download/ redirects to the tagged asset.
  code="$(curl -sIL -o /dev/null -w '%{http_code}' --max-time 30 "$url")"
  name="${url##*/}"
  if [ "$code" = "200" ]; then
    printf '  ok    %s\n' "$name"
  else
    printf '  FAIL  %s -> HTTP %s\n' "$name" "$code"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  cat >&2 <<'MSG'

One or more downloads are broken. Most likely cause: an asset was renamed in
sanctum-desktop's release.yml ("Stage the version-less copies"), and the hrefs
in index.html no longer match. Compare the two and fix index.html.
MSG
  exit 1
fi

echo "All ${#urls[@]} downloads resolve."
```

- [ ] **Step 2: Make it executable and run it**

```bash
chmod +x check-links.sh
bash check-links.sh
```

Expected:

```
  ok    Sanctum-Desktop-arm64.dmg
  ok    Sanctum-Desktop-x86_64.AppImage
  ok    sanctum-desktop-amd64.deb
All 3 downloads resolve.
```

- [ ] **Step 3: Prove the guard actually catches a break**

A check that cannot fail is not a check. Break a filename on purpose, confirm the script fails, then restore it:

```bash
sed -i '' 's/Sanctum-Desktop-arm64\.dmg/Sanctum-Desktop-arm64-WRONG.dmg/' index.html
bash check-links.sh; echo "exit=$?"
```

Expected: `FAIL  Sanctum-Desktop-arm64-WRONG.dmg -> HTTP 404`, and `exit=1`.

```bash
git checkout index.html
bash check-links.sh; echo "exit=$?"
```

Expected: all three ok, `exit=0`.

- [ ] **Step 4: Write `.github/workflows/links.yml`**

```yaml
name: Links

# The push trigger catches a mistake made here. The schedule catches one made
# in sanctum-desktop — a renamed release asset breaks every download on this
# page without a single commit landing in this repo. That is the run that
# matters, and it is why this is a separate workflow from pages.yml: a deploy
# has no business running on a timer.
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 9 * * 1'
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Unit tests
        run: node --test
      - name: Download links resolve
        run: bash check-links.sh
```

- [ ] **Step 5: Run the full suite as CI will**

```bash
node --test && bash check-links.sh
```

Expected: 24 tests pass, then all three downloads resolve.

- [ ] **Step 6: Commit**

```bash
git add check-links.sh .github/workflows/links.yml
git commit -m "Catch a renamed release asset before a tester does"
```

---

### Task 6: Publish to GitHub Pages

**Files:**
- Create: `/Users/filippo/Desktop/sanctum-site/.github/workflows/pages.yml`

**Interfaces:**
- Consumes: everything above.
- Produces: the live site.

- [ ] **Step 1: Write `.github/workflows/pages.yml`**

```yaml
name: Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# Never let two deploys race; a half-published page is worse than a late one.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      # No build step, so the repo is the artifact. docs/ and README.md ship
      # with it; both are already public, so this costs nothing but tidiness.
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "Deploy the page from main"
```

- [ ] **Step 3: Create the public repo and push**

This is the first step that is visible to anyone else. Everything before it was local.

```bash
cd /Users/filippo/Desktop/sanctum-site
gh repo create sanctum-site --public \
  --description "Download page for Sanctum Desktop" \
  --source . --remote origin --push
```

- [ ] **Step 4: Point Pages at Actions**

```bash
gh api -X POST repos/FilippoTonci/sanctum-site/pages \
  -f 'build_type=workflow' 2>/dev/null ||
gh api -X PUT repos/FilippoTonci/sanctum-site/pages \
  -f 'build_type=workflow'
```

Expected: Pages configured with `build_type: workflow`. If both calls fail, set it by hand: Settings → Pages → Source → GitHub Actions.

- [ ] **Step 5: Watch both workflows**

```bash
gh run list --limit 5
gh run watch "$(gh run list --workflow=pages.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

Expected: both `Pages` and `Links` conclude successfully.

- [ ] **Step 6: Verify the deployed site, not the local copy**

```bash
URL=https://filippotonci.github.io/sanctum-site/
curl -sIL -o /dev/null -w 'page: %{http_code}\n' "$URL"

# The stylesheet and module must resolve at their deployed paths — a relative
# path that works over `python3 -m http.server` can still 404 under a project
# subpath.
for f in style.css os.js assets/sanctum-logo.png; do
  curl -sIL -o /dev/null -w "$f: %{http_code}\n" "$URL$f"
done

# And the download hrefs survived deployment intact.
curl -s "$URL" | grep -oE 'releases/latest/download/[A-Za-z0-9._-]+' | sort -u
```

Expected: `200` for the page and all three assets, and exactly the three known filenames.

- [ ] **Step 7: Manual checks before sending anyone the link**

Per the spec, and none of these can be automated here:

- Phone width — no horizontal scroll, the `xattr` block scrolls rather than widening the page
- Dark mode — toggle the OS appearance
- JavaScript disabled — all three downloads still work
- One real download-and-open on an Apple Silicon Mac, following the `xattr` instruction exactly as written on the page

- [ ] **Step 8: Commit any fixes those checks surface**

```bash
git add -A && git commit -m "Fix <what the manual checks found>"
git push
```

---

## Notes for the executor

- **`page.test.js` is not in the spec's file tree, deliberately.** The spec lists
  `os.test.js` only. Review Focus 2 and 4 are properties of the *markup* — that
  the macOS label says "Apple Silicon", and that every `href` is complete in the
  HTML — so they cannot be tested from `os.js`. It is a plain string assertion
  over `index.html`, which keeps the repo free of a DOM library.
- **Do not add a `package.json`.** `node --test` is built into Node 20 and discovers `*.test.js` on its own. Adding npm to save a keystroke costs the repo its only real invariant.
- **If a design token looks wrong, check `sanctum-desktop/src/renderer/src/index.css` rather than adjusting it here.** The values in Task 2 were copied from it; the site and the app should not drift apart.
- **The `xattr` command must stay byte-identical** to the one in the release notes generated by `sanctum-desktop`'s `publish` job. A tester who reads both should not see two different instructions.
