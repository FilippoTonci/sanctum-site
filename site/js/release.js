// Turns a GitHub release object into the line shown under the downloads.
//
// Pure: the fetch itself lives in enhance.js, so every failure shape the API
// can return is testable here without a network.

export const RELEASES_API =
  'https://api.github.com/repos/FilippoTonci/sanctum-desktop/releases/latest'

// The permalink filenames deliberately carry no version, so this line is the
// only way a tester can tell which build they just downloaded.
export function formatVersion(release) {
  const tag = release?.tag_name
  if (typeof tag !== 'string' || tag === '') return null

  const published = new Date(release?.published_at ?? NaN)
  if (Number.isNaN(published.getTime())) return tag

  const when = published.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `${tag} · released ${when}`
}
