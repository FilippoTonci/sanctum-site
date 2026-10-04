import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

// All four stylesheets, concatenated: the assertions below are properties of
// the stylesheet as a whole, not of whichever file happens to hold a rule.
const css = ['tokens', 'base', 'hero', 'content', 'download']
  .map((name) => readFileSync(new URL(`../site/styles/${name}.css`, import.meta.url), 'utf8'))
  .join('\n')

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

// The pairs the stylesheet actually creates. A review once measured dimmed copy
// at 2.18:1 — below even the 3:1 large-text floor — because `opacity`
// composites text toward its background. The tokens are fine; the mechanism
// was not.
const USED_PAIRS = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-2', 'bg'],
  ['text-2', 'surface'],
  ['text-3', 'surface'],
  ['accent-fg', 'accent'],
  ['accent', 'bg'],
  ['band-text', 'band'],
  ['band-text-2', 'band'],
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

// The app's --text-3 (#8b8b91) misses AA on the page background, which is why
// the site carries a darker one. Re-copying the app's value must not slip
// through unnoticed.
test('--text-3 is darker than the app value, so it passes on the page background', () => {
  const ratio = contrast(token('text-3', 'light'), token('bg', 'light'))
  assert.ok(ratio >= 4.5, `--text-3 on --bg is ${ratio.toFixed(2)}:1`)
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

// Moving the stylesheets into styles/ silently broke every font: url() in CSS
// resolves against the stylesheet's own location, not the document's, so
// 'assets/fonts/x.woff2' became site/styles/assets/fonts/x.woff2 and 404'd.
// The page still rendered — in fallback serif — so only a real browser or this
// test would notice.
test('every @font-face src resolves to a file that exists', () => {
  const sheet = new URL('../site/styles/tokens.css', import.meta.url)
  const tokens = readFileSync(sheet, 'utf8')
  const srcs = [...tokens.matchAll(/src:\s*url\('([^']+)'\)/g)].map((m) => m[1])
  assert.ok(srcs.length >= 3, `expected at least 3 @font-face srcs, found ${srcs.length}`)
  for (const src of srcs) {
    const resolved = new URL(src, sheet)
    assert.ok(
      existsSync(resolved),
      `@font-face src '${src}' resolves to ${resolved.pathname}, which does not exist`,
    )
  }
})

// The base styles are the finished frame; motion is opt-in. An animation
// declared outside the no-preference block would run for people who asked
// their system for reduced motion.
test('every animation runs only when the visitor allows motion', () => {
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const outside = declarations
    .split('@media (prefers-reduced-motion: no-preference)')
    .map((chunk, i) => (i === 0 ? chunk : chunk.slice(matchingBrace(chunk))))
    .join('\n')
  assert.doesNotMatch(outside, /[{;\s]animation:/, 'animation declared outside the motion query')
})

/** Index just past the brace that closes the @media block a chunk starts in. */
function matchingBrace(chunk) {
  let depth = 0
  for (let i = 0; i < chunk.length; i++) {
    if (chunk[i] === '{') depth++
    if (chunk[i] === '}' && --depth === 0) return i + 1
  }
  return chunk.length
}
