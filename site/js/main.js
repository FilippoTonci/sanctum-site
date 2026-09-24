// The browser entry point, and the only file here with side effects.
//
// Everything it calls is pure or takes its dependencies as arguments; this is
// where the real document and the real fetch get handed over. Keeping that in
// one file is what makes "nothing happens on import" checkable —
// tests/enhance.test.js imports the other modules freely.

import { applyOs, applyVersion } from './enhance.js'

try {
  applyOs(document, navigator)
} catch {
  // Leaves the page in its no-JS state, which is fully functional.
}

// Deliberately not awaited: the version line is the last thing that matters on
// this page, and a hung request must not delay anything.
applyVersion(document, fetch).catch(() => {
  // Rate-limited, offline, or blocked. The line stays hidden.
})
