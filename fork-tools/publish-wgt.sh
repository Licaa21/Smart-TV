#!/bin/bash
# Puts the package built in daily on GitHub as a release of its own. Releases are kept, a build never replaces another:
# each is named by the fork's version and described by what was committed since the last one, with the commit ids.
# The fork's version always has three numbers: 1.0.0 for the first, then BUMP says how far it moves from the last release: patch
# (1.0.1, 1.0.2) for a single change or fixes, minor (1.1.0, 1.2.0) for medium sized changes, major (2.0.0, 3.0.0) for a whole
# batch of 10 to 20 changes. FORK_VERSION=<x.y[.z]> sets it outright (a missing last number is made 0). Run by build-daily-wgt.sh, and on its own to publish a package that is already
# built, for which PREV=<commit or tag> sets where the description starts and BUILT_FROM=<commit> names the commit the
# package was built from (the commit checked out, when not given).
set -e
cd "$(git rev-parse --show-toplevel)"
# gh is installed under the user's AppData and a shell does not always have it on its path
if ! command -v gh >/dev/null 2>&1 && [ -n "$LOCALAPPDATA" ] && [ -x "$(cygpath -u "$LOCALAPPDATA")/GitHubCLI/bin/gh.exe" ]; then
  export PATH="$PATH:$(cygpath -u "$LOCALAPPDATA")/GitHubCLI/bin"
fi
if ! command -v gh >/dev/null 2>&1; then
  [ "${1:-}" = "--version" ] || echo "gh is not installed or not on the path, so nothing was published. The package is here."
  exit 0
fi
REPO="$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
# The last version released, the highest of the fork-v tags that are there
tags="$(gh release list --repo "$REPO" --limit 500 --json tagName --jq '.[].tagName')"
last="$(echo "$tags" | grep -E '^fork-v[0-9]+\.[0-9]+(\.[0-9]+)?$' | sed 's/^fork-v//' | sort -V | tail -1 || true)"
if [ -n "${FORK_VERSION:-}" ]; then
  n="$FORK_VERSION"
  [ "$(echo "$n" | tr -cd .)" = "." ] && n="$n.0"
elif [ -z "$last" ]; then
  n="1.0.0"
else
  IFS=. read -r major minor patch <<< "$last"
  case "${BUMP:-}" in
    major) n="$((major + 1)).0.0" ;;
    minor) n="$major.$((minor + 1)).0" ;;
    patch) n="$major.$minor.$((${patch:-0} + 1))" ;;
    *) echo "Say how far the fork's version moves from $last: BUMP=patch, minor or major bash fork-tools/publish-wgt.sh" >&2; exit 1 ;;
  esac
fi
# --version only says which version the next release is, so the build can stamp it into the app before it compiles
if [ "${1:-}" = "--version" ]; then echo "$n"; exit 0; fi

built="$(ls -t Moonfin_Tizen_Regular_*_Lica_Fork*.wgt 2>/dev/null | head -1)"
[ -n "$built" ] || { echo "No package to publish."; exit 1; }
version="$(echo "$built" | sed -E 's/^Moonfin_Tizen_Regular_v([0-9.]+)_Lica_Fork.*$/\1/')"
from="$(git rev-parse "${BUILT_FROM:-HEAD}")"

# The description starts at the last release, or where PREV says
prev="${PREV:-}"
if [ -z "$prev" ] && [ -n "$last" ]; then
  git fetch -q origin "refs/tags/fork-v$last:refs/tags/fork-v$last" 2>/dev/null || true
  prev="fork-v$last"
fi
git rev-parse -q --verify "$prev^{commit}" >/dev/null 2>&1 || prev="$from~30"

notes="$(mktemp)"
log="$(mktemp)"
# a commit that only changes CLAUDE.md or the README is not part of what the build changed
git log --no-merges --format='%an%x09%h%x09%s' "$prev..$from" | awk -F'	' '$3 !~ /^(CLAUDE.md|README|config.xml):/' > "$log"
{
  echo "Lica's Fork $n for Moonfin $version, built from commit \`$from\` on $(date '+%Y-%m-%d %H:%M')."
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
for old in Moonfin_Tizen_Regular_*_Lica_Fork_v[0-9]*.wgt; do
  [ "$old" = "$built" ] || [ "$old" = "$versioned" ] || rm -f "$old"
done
[ "$built" = "$versioned" ] || mv -f "$built" "$versioned"

gh release create "fork-v$n" "$versioned" --repo "$REPO" --target "$from" \
  --title "Lica's Fork $n (Moonfin $version)" --notes-file "$notes" --latest
# The TV-Store reads config.xml from the main branch of the repository, so the fork's version goes there too: this one
# line is the only thing committed to main besides the README and the ignore rules.
MAIN_DIR="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
config=packages/build-tizen/tizen/config.xml
# only when main is on its own branch with that file untouched, so nothing of someone's is thrown away
if [ -f "$MAIN_DIR/$config" ] && ! grep -q "<widget [^>]* version=\"$n\"" "$MAIN_DIR/$config"   && [ "$(git -C "$MAIN_DIR" branch --show-current)" = "main" ] && git -C "$MAIN_DIR" diff --quiet HEAD -- "$config"; then
  sed -i -E "s/(<widget [^>]* version=\")[0-9.]+(\")/\1$n\2/" "$MAIN_DIR/$config"
  if ! grep -q "<widget [^>]* version=\"$n\"" "$MAIN_DIR/$config"; then
    git -C "$MAIN_DIR" checkout -- "$config"
    echo "config.xml in main did not take the version $n. Do it by hand."
  elif ! git -C "$MAIN_DIR" -c user.name=Licaa21 -c user.email=184849302+Licaa21@users.noreply.github.com commit -q -m "config.xml: the fork's version $n" -- "$config"; then
    git -C "$MAIN_DIR" checkout -- "$config"
    echo "The version $n was not committed to main. Do it by hand: config.xml in main, then push."
  elif ! git -C "$MAIN_DIR" push -q origin main; then
    echo "The version $n is committed in main but was not pushed. Push main by hand."
  fi
fi
echo "Published $versioned: https://github.com/$REPO/releases/tag/fork-v$n"
echo "The newest one is always at https://github.com/$REPO/releases/latest"
