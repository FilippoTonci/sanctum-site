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
//
// Asserts the URL is an href on an actual <a>, not just present somewhere in
// the file. A review found that `html.includes(url)` passed against a page
// whose macOS anchor had no href at all, with the URL surviving only inside an
// HTML comment — a dead button, CI green.
test('every download URL is an href on a real anchor', () => {
  const anchors = html.match(/<a\b[^>]*>/g) ?? []
  for (const asset of Object.values(ASSETS)) {
    const url = `${BASE}/${asset}`
    assert.ok(
      anchors.some((tag) => tag.includes(`href="${url}"`)),
      `no <a> carries href="${url}" — a URL in a comment or in text is not a download`,
    )
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
