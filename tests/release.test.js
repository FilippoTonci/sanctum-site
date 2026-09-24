import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatVersion } from '../site/js/release.js'
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
