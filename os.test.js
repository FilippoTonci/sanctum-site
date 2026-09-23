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

import { applyOs, applyVersion } from './os.js'

// A minimal stub document that records ANY attempt to write a download href,
// whether through the property or setAttribute.
function stubDoc() {
  const hrefWrites = []
  const anchor = (platform, href) => {
    const a = { dataset: { platform }, _href: href }
    Object.defineProperty(a, 'href', {
      get: () => a._href,
      set: (v) => {
        hrefWrites.push(v)
        a._href = v
      },
    })
    a.setAttribute = (name, value) => {
      if (name === 'href') hrefWrites.push(value)
    }
    a.removeAttribute = (name) => {
      if (name === 'href') hrefWrites.push('<removed>')
    }
    return a
  }
  const anchors = [anchor('mac', 'URL_MAC'), anchor('linux', 'URL_LINUX')]
  const version = { textContent: '', hidden: true }
  return {
    body: { dataset: {} },
    getElementById: (id) => (id === 'version' ? version : null),
    querySelectorAll: () => anchors,
    anchors,
    version,
    hrefWrites,
  }
}

// The spec calls this "the rule that makes every failure mode benign", and a
// review found it had no automated guard at all: injecting an href rewrite into
// applyOs left all tests passing and check-links.sh reporting success.
test('the OS wiring sets one attribute and never touches an href', () => {
  const doc = stubDoc()
  applyOs(doc, { platform: 'MacIntel', maxTouchPoints: 0 })
  assert.equal(doc.body.dataset.os, 'mac')
  assert.deepEqual(doc.hrefWrites, [], 'JavaScript must never write a download href')
  assert.deepEqual(doc.anchors.map((a) => a.href), ['URL_MAC', 'URL_LINUX'])
})

test('an unknown platform sets no attribute at all', () => {
  const doc = stubDoc()
  applyOs(doc, { platform: 'FreeBSD' })
  assert.equal(doc.body.dataset.os, undefined)
  assert.deepEqual(doc.hrefWrites, [])
})

test('the version wiring touches only #version, never an href', async () => {
  const doc = stubDoc()
  const ok = async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v1.2.3', published_at: '2026-09-23T18:59:17Z' }),
  })
  await applyVersion(doc, ok)
  assert.match(doc.version.textContent, /v1\.2\.3/)
  assert.equal(doc.version.hidden, false)
  assert.deepEqual(doc.hrefWrites, [], 'JavaScript must never write a download href')
  assert.deepEqual(doc.anchors.map((a) => a.href), ['URL_MAC', 'URL_LINUX'])
})

test('a rate-limited response leaves #version hidden and empty', async () => {
  const doc = stubDoc()
  const rateLimited = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'API rate limit exceeded for 1.2.3.4' }),
  })
  await applyVersion(doc, rateLimited)
  assert.equal(doc.version.hidden, true)
  assert.equal(doc.version.textContent, '')
  assert.deepEqual(doc.hrefWrites, [])
})
