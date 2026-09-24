#!/usr/bin/env bash
# Assert that every download link in site/index.html actually resolves.
#
# The filenames come from the "Stage the version-less copies" step in
# sanctum-desktop/.github/workflows/release.yml. Nothing in either repo's
# type system or CI connects the two. This script is that connection, and the
# weekly schedule in links.yml is what makes it catch a change made over
# there — no push here would.
#
# Reads the URLs out of site/index.html on purpose: a hardcoded list in this file
# could pass while the page 404s.
set -euo pipefail

cd "$(dirname "$0")"

# `while read` rather than `mapfile`: macOS ships bash 3.2, where mapfile does
# not exist. Verified — it fails there with "mapfile: command not found" and,
# worse, the empty array then reports as "no URLs found in site/index.html", which
# points at the wrong file. Process substitution works in 3.2.
urls=()
while IFS= read -r url; do
  urls+=("$url")
done < <(
  # Matches href="URL", not a bare URL: a review showed that grepping for the
  # URL alone reported "All 3 downloads resolve" against a page whose macOS
  # anchor had no href, the URL surviving only in an HTML comment.
  grep -oE 'href="https://github\.com/FilippoTonci/sanctum-desktop/releases/latest/download/[A-Za-z0-9._-]+"' site/index.html |
    sed -e 's/^href="//' -e 's/"$//' |
    sort -u
)

if [ "${#urls[@]}" -eq 0 ]; then
  echo "FAIL: no download URLs found in site/index.html." >&2
  echo "      Either the links were removed or the URL shape changed." >&2
  exit 1
fi

# Guards against a link silently disappearing: macOS dmg, Linux AppImage, deb.
if [ "${#urls[@]}" -ne 3 ]; then
  printf 'FAIL: expected 3 distinct download URLs in site/index.html, found %d:\n' "${#urls[@]}" >&2
  printf '      %s\n' "${urls[@]}" >&2
  exit 1
fi

failed=0
for url in "${urls[@]}"; do
  # -L because /releases/latest/download/ redirects to the tagged asset.
  code="$(curl -sIL -o /dev/null -w '%{http_code}' --max-time 30 "$url")"
  name="${url##*/}"
  if [ "$code" = "200" ]; then
    printf '  ok    %s\n' "$name"
  else
    printf '  FAIL  %s -> HTTP %s\n' "$name" "$code"
    failed=1
  fi
done

if [ "$failed" -ne 0 ]; then
  cat >&2 <<'MSG'

One or more downloads are broken. Most likely cause: an asset was renamed in
sanctum-desktop's release.yml ("Stage the version-less copies"), and the hrefs
in site/index.html no longer match. Compare the two and fix site/index.html.
MSG
  exit 1
fi

echo "All ${#urls[@]} downloads resolve."
