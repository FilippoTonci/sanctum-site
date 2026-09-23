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
