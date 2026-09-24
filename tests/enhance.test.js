import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyOs, applyVersion } from '../site/js/enhance.js'
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
