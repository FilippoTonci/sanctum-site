import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./style.css', import.meta.url), 'utf8')

/** Relative luminance per WCAG 2.1. */
function luminance(hex) {
  const [r, g, b] = hex
    .replace('#', '')
    .match(/../g)
    .map((h) => {
      const c = parseInt(h, 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function token(name, scheme) {
  const blocks = css.split('@media (prefers-color-scheme: dark)')
  const source = scheme === 'light' ? blocks[0] : blocks[1]
  const m = source.match(new RegExp(`--${name}:\\s*([^;]+);`))
  assert.ok(m, `token --${name} not found in the ${scheme} scheme`)
  return m[1].trim()
}

/** A rule's declarations with comments stripped — a comment explaining why a
 *  value is avoided must not read as a use of it. */
function rule(selectorFragment) {
  const m = css.match(new RegExp(`[^}]*${selectorFragment}[^{]*\\{([^}]*)\\}`))
  assert.ok(m, `no rule matching ${selectorFragment}`)
  return m[1].replace(/\/\*[\s\S]*?\*\//g, '')
}

// The pairs the stylesheet actually creates. A review measured the dimmed copy
// at 2.18:1 — below even the 3:1 large-text floor — because `opacity`
// composites text toward its background. The tokens are fine; the mechanism
// was not.
const USED_PAIRS = [
  ['ink', 'paper'],
  ['ink', 'paper-elevated'],
  ['ink-soft', 'paper'],
  ['ink-muted', 'paper-elevated'],
]

test('every text/surface pair the stylesheet uses meets WCAG AA', () => {
  for (const scheme of ['light', 'dark']) {
    for (const [fg, bg] of USED_PAIRS) {
      const ratio = contrast(token(fg, scheme), token(bg, scheme))
      assert.ok(
        ratio >= 4.5,
        `--${fg} on --${bg} (${scheme}) is ${ratio.toFixed(2)}:1, needs 4.5:1`,
      )
    }
  }
})

// Encodes why --ink-muted may not be used on the page background: it misses AA
// there by a hair in light mode. Without this, a future edit reintroduces it
// and nothing objects.
test('--ink-muted is unusable on the page background, which is why nothing uses it there', () => {
  const ratio = contrast(token('ink-muted', 'light'), token('paper', 'light'))
  assert.ok(ratio < 4.5, 'if this now passes, the restriction below can be relaxed')
  assert.doesNotMatch(
    rule('\\.version'),
    /--ink-muted/,
    '.version sits on --paper, where --ink-muted fails AA',
  )
})

test('the unavailable download row recedes by colour, not opacity', () => {
  const body = rule('\\.dl-unavailable')
  assert.doesNotMatch(
    body,
    /opacity/,
    'opacity would drag the only text explaining the missing Windows build below AA',
  )
  assert.match(body, /color:/)
})

test('first-run instructions are never dimmed by opacity', () => {
  assert.doesNotMatch(
    css.replace(/\/\*[\s\S]*?\*\//g, ''),
    /\.instructions:not\([^)]*\)[^{]*\{[^}]*opacity/,
    'a tester reading another platform’s instructions still needs to read them',
  )
})

// Review finding (deferred, then decided): flexbox `order` made visual order
// diverge from DOM order for Linux visitors, so the first Tab press landed on
// the macOS .dmg and a screen reader read the macOS instructions first
// (WCAG 1.3.2 / 2.4.3). Emphasis by colour identifies the visitor's platform
// without reordering anything.
test('no rule reorders content away from DOM order', () => {
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
  // Boundary matters: "border:" contains "order:".
  assert.doesNotMatch(
    declarations,
    /[;{\s]order:\s*-?\d/,
    'reordering makes tab and screen-reader order disagree with what is seen',
  )
})

test('fonts are served from this origin', () => {
  assert.match(css, /@font-face/, 'fonts must be declared locally')
  const srcs = css.match(/src:\s*url\(([^)]+)\)/g) ?? []
  assert.ok(srcs.length > 0, 'no @font-face src found')
  for (const src of srcs) {
    assert.doesNotMatch(src, /^https?:|\/\//, `third-party font source: ${src}`)
  }
})
