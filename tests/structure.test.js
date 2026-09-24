import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const workflow = (name) =>
  readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8')

// Publishing the whole checkout put an implementation plan — with absolute
// local paths in it — on the public web. `site/` exists so that cannot recur:
// anything outside it is unpublishable by construction, not by remembering.
test('Pages publishes only the site directory', () => {
  const yml = workflow('pages.yml')
  const path = yml.match(/path:\s*(\S+)/)
  assert.ok(path, 'pages.yml declares no upload path')
  assert.equal(path[1], 'site', 'only site/ may be published')
})

test('nothing outside site/ is served', () => {
  const served = readdirSync(new URL('../site/', import.meta.url))
  for (const entry of ['docs', 'tests', 'check-links.sh', 'README.md']) {
    assert.ok(!served.includes(entry), `${entry} must not live under site/`)
  }
})

// main.js is the entry point and the only file allowed to touch globals. Node
// has no `document`, so a module that reached for one at import time would
// throw here — which makes the rule checkable rather than aspirational.
test('every module but main.js imports cleanly without a DOM', async () => {
  assert.equal(typeof globalThis.document, 'undefined', 'this test needs a DOM-less env')
  for (const name of ['platform.js', 'release.js', 'enhance.js']) {
    await assert.doesNotReject(
      () => import(new URL(`../site/js/${name}`, import.meta.url)),
      `${name} must not act on import`,
    )
  }
})

test('main.js is the only entry point referenced by the page', () => {
  const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8')
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(scripts, ['js/main.js'])
})
