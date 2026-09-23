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
// are unknown rather than wrong.
const HANDHELD = /iphone|ipad|ipod|android/i

// The AppImage and the .deb are both x86_64-only, so a Linux platform string
// naming any other architecture must not be promoted. This is where Android
// reporting itself as "Linux armv8l" through the legacy field lands, along
// with Asahi, Raspberry Pi OS and ARM Chromebooks.
//
// A bare "Linux" stays promoted: that is what userAgentData.platform reports
// on every desktop Linux whatever the CPU, so it is the common case, and the
// row is labelled x86_64 for the rest.
const NON_X86_LINUX = /linux\s+(arm|aarch64|riscv|ppc|s390|mips)/i

export function detectOs(platform, { maxTouchPoints = 0 } = {}) {
  if (typeof platform !== 'string' || platform.trim() === '') return 'unknown'
  if (HANDHELD.test(platform) || NON_X86_LINUX.test(platform)) return 'unknown'

  // iPadOS 13+ reports "MacIntel" and is indistinguishable from a desktop Mac
  // except by touch points. A Mac with a touchscreen does not exist; an iPad
  // pretending to be one does. Treat touch + Mac as a tablet.
  if (/mac/i.test(platform) && maxTouchPoints > 1) return 'unknown'

  for (const [pattern, name] of PATTERNS) {
    if (pattern.test(platform)) return name
  }
  return 'unknown'
}

export function readPlatform(navigatorLike) {
  if (!navigatorLike || typeof navigatorLike !== 'object') return ''
  const modern = navigatorLike.userAgentData?.platform
  if (typeof modern === 'string' && modern !== '') return modern
  const legacy = navigatorLike.platform
  return typeof legacy === 'string' ? legacy : ''
}

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

// --- Wiring -----------------------------------------------------------------
// Everything above is pure and tested. Everything below touches the document
// and runs only in a browser.
//
// This sets one attribute. It does not create elements, and it does not touch
// a single href — CSS does all the reordering and emphasis from `data-os`.
// That division is why a failure here costs the visitor a highlight rather
// than a download.

export function applyOs(doc, navigatorLike) {
  const os = detectOs(readPlatform(navigatorLike), {
    maxTouchPoints: navigatorLike?.maxTouchPoints ?? 0,
  })
  if (os !== 'unknown') doc.body.dataset.os = os
}

// Unauthenticated GitHub API calls are capped at 60/hour per IP. Past that it
// returns 403 with a JSON body that has no tag_name. Every failure path here
// ends the same way: the element stays hidden and nothing else is touched.
export async function applyVersion(doc, fetchImpl) {
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
