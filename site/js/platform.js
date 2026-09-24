// Maps a platform string to the download we should promote.
//
// Two sources feed this: `navigator.userAgentData.platform` ("macOS",
// "Windows", "Linux") where available, and the older `navigator.platform`
// ("MacIntel", "Win32", "Linux x86_64") everywhere else. Both go through here.
//
// Pure: no DOM, no network. Everything here is exercised directly by
// tests/platform.test.js.

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
