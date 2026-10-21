#!/bin/bash
# Puts the package built in daily on GitHub as a release of its own. Releases are kept, a build never replaces another:
# each is named by the fork's version (Lica Fork v1, v2 and so on, counted from the releases already there) and described
# by what was committed since the last one, with the commit ids. Run by build-daily-wgt.sh, and on its own to publish a
# package that is already built, for which PREV=<commit or tag> sets where the description starts and BUILT_FROM=<commit>
# names the commit the package was built from (the commit checked out, when not given).
set -e
cd "$(git rev-parse --show-toplevel)"
# gh is installed under the user's AppData and a shell does not always have it on its path
if ! command -v gh >/dev/null 2>&1 && [ -n "$LOCALAPPDATA" ] && [ -x "$(cygpath -u "$LOCALAPPDATA")/GitHubCLI/bin/gh.exe" ]; then
  export PATH="$PATH:$(cygpath -u "$LOCALAPPDATA")/GitHubCLI/bin"
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "gh is not installed or not on the path, so nothing was published. The package is here."
  exit 0
fi
REPO="$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
built="$(ls -t Moonfin_Tizen_Regular_*_Lica_Fork*.wgt 2>/dev/null | head -1)"
[ -n "$built" ] || { echo "No package to publish."; exit 1; }
version="$(echo "$built" | sed -E 's/^Moonfin_Tizen_Regular_v([0-9.]+)_Lica_Fork.*$/\1/')"

# The fork's version is one more than the releases of this kind that are there
count="$(gh release list --repo "$REPO" --limit 500 --json tagName --jq '.[].tagName' | grep -c '^fork-v' || true)"
n=$((count + 1))
from="$(git rev-parse "${BUILT_FROM:-HEAD}")"

# The description starts at the last release, or where PREV says
prev="${PREV:-}"
if [ -z "$prev" ] && [ "$count" -gt 0 ]; then
  git fetch -q origin "refs/tags/fork-v$count:refs/tags/fork-v$count" 2>/dev/null || true
  prev="fork-v$count"
fi
git rev-parse -q --verify "$prev^{commit}" >/dev/null 2>&1 || prev="$from~30"

notes="$(mktemp)"
log="$(mktemp)"
git log --no-merges --format='%an%x09%h%x09%s' "$prev..$from" > "$log"
{
  echo "Lica Fork v$n for Moonfin $version, built from commit \`$from\` on $(date '+%Y-%m-%d %H:%M')."
  echo
  echo "What was done since $(git rev-parse --short "$prev") (commit ids in brackets)."
  if awk -F'\t' '$1=="Licaa21"' "$log" | grep -q .; then
    echo
    echo "### The fork"
    awk -F'\t' '$1=="Licaa21" {printf "- %s (`%s`)\n", $3, $2}' "$log"
  fi
  if awk -F'\t' '$1!="Licaa21"' "$log" | grep -q .; then
    echo
    echo "### From upstream Moonfin"
    awk -F'\t' '$1!="Licaa21" {printf "- %s (`%s`)\n", $3, $2}' "$log"
  fi
} > "$notes"

# The file carries the fork's version too, and the one left from the last build goes
versioned="Moonfin_Tizen_Regular_v${version}_Lica_Fork_v${n}.wgt"
if [ "$built" != "$versioned" ]; then
  rm -f Moonfin_Tizen_Regular_*_Lica_Fork_v[0-9]*.wgt
  mv -f "$built" "$versioned"
fi

gh release create "fork-v$n" "$versioned" --repo "$REPO" --target "$from" \
  --title "Lica Fork v$n (Moonfin $version)" --notes-file "$notes" --latest
echo "Published $versioned: https://github.com/$REPO/releases/tag/fork-v$n"
echo "The newest one is always at https://github.com/$REPO/releases/latest"
