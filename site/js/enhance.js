// The two things JavaScript is allowed to do to this page.
//
// Both take their document (and fetch) as arguments rather than reaching for
// globals, so tests/enhance.test.js can run them against a stub and assert
// what they touch. Neither runs on import — main.js is the only entry point.
//
// What they must never do: create, rewrite or remove a download href. CSS does
// all reordering and emphasis from the `data-os` attribute. That division is
// why a failure here costs the visitor a highlight rather than a download.

import { detectOs, readPlatform } from './platform.js'
import { formatVersion, RELEASES_API } from './release.js'

export function applyOs(doc, navigatorLike) {
  const os = detectOs(readPlatform(navigatorLike), {
    maxTouchPoints: navigatorLike?.maxTouchPoints ?? 0,
  })
  if (os !== 'unknown') doc.body.dataset.os = os
}

// Unauthenticated GitHub API calls are capped at 60/hour per IP. Past that it
// returns 403 with a JSON body that has no tag_name. Every failure path here
// ends the same way: the element stays hidden and nothing else is touched.
export async function applyVersion(doc, fetchImpl) {
  const el = doc.getElementById('version')
  if (!el) return
  const response = await fetchImpl(RELEASES_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return
  const line = formatVersion(await response.json())
  if (line === null) return
  el.textContent = line
  el.hidden = false
}
