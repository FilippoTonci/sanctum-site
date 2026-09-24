import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectOs } from '../site/js/platform.js'

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

import { readPlatform } from '../site/js/platform.js'

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

// Review finding (Important 1): "Linux arm" caught armv7l/armv8l/arm64 but not
// aarch64, the most common modern spelling — so Firefox on Android, Asahi,
// Raspberry Pi OS and ARM Chromebooks were promoted an x86_64-only AppImage.
test('treats non-x86 Linux architectures as unknown', () => {
  for (const p of [
    'Linux aarch64',
    'Linux arm64',
    'Linux armv7l',
    'Linux armv8l',
    'Linux riscv64',
    'Linux ppc64le',
    'Linux s390x',
    'Linux mips64',
  ]) {
    assert.equal(detectOs(p), 'unknown', `${p} cannot run the x86_64 AppImage`)
  }
})

// Must not regress: userAgentData.platform reports a bare "Linux" with no
// architecture on every desktop Linux, and that is the common case.
test('still promotes x86 Linux, including the bare userAgentData value', () => {
  for (const p of ['Linux', 'Linux x86_64', 'Linux i686', 'Linux amd64']) {
    assert.equal(detectOs(p), 'linux', `${p} should be promoted`)
  }
})
