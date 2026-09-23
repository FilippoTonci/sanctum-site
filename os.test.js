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
    { message: 'API rate limit exceeded for 1.2.3.4' },
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
