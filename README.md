# sanctum-site

The download page for [Sanctum Desktop](https://github.com/FilippoTonci/sanctum-desktop),
served by GitHub Pages at <https://filippotonci.github.io/sanctum-site>.

Static HTML and CSS. No build step, no npm dependencies. What is committed is
what is served.

## Local preview

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tests

```bash
node --test        # OS detection and version formatting
bash check-links.sh  # the three download permalinks return 200
```

`check-links.sh` guards a coupling that spans two repos: the asset filenames
are produced by `release.yml` in `sanctum-desktop` and hardcoded as `href`s
here. It runs on every push and on a weekly schedule — the schedule is what
catches a rename made in the other repo.
