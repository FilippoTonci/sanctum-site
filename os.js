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
