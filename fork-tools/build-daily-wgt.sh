#!/bin/bash
# Builds the Tizen package for daily use. Only the daily folder builds packages, and they are
# never committed (*.wgt is ignored). It is the regular build, not --oblong or --legacy, and it is
# named after the upstream package with _Lica_Fork added:
#   Moonfin_Tizen_Regular_<version>_Lica_Fork.wgt
# The newest one is then put on the "latest" release of the fork on GitHub, replacing the last, so the
# link to it never changes and the history does not grow.
set -e
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = "daily" ] || { echo "Packages are only built on the daily branch."; exit 1; }
# The commit the package is built from, printed in the diagnostic report so a log says which build made it
export REACT_APP_BUILD_ID="$(git rev-parse --short HEAD)"
npm run build:tizen
for built in Moonfin_Tizen_Regular_*.wgt; do
  case "$built" in
    *_Lica_Fork.wgt) ;;
    *) mv -f "$built" "${built%.wgt}_Lica_Fork.wgt"; echo "Built ${built%.wgt}_Lica_Fork.wgt" ;;
  esac
done
# A failed upload does not undo the build, the package is still here
# gh is installed under the user's AppData and a shell does not always have it on its path
if ! command -v gh >/dev/null 2>&1 && [ -n "$LOCALAPPDATA" ] && [ -x "$(cygpath -u "$LOCALAPPDATA")/GitHubCLI/bin/gh.exe" ]; then
  export PATH="$PATH:$(cygpath -u "$LOCALAPPDATA")/GitHubCLI/bin"
fi
RELEASE_REPO="$(git remote get-url origin | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
for built in Moonfin_Tizen_Regular_*_Lica_Fork.wgt; do
  if command -v gh >/dev/null 2>&1 && {
    gh release delete latest --repo "$RELEASE_REPO" --cleanup-tag --yes >/dev/null 2>&1 || true
    gh release create latest "$built" --repo "$RELEASE_REPO" --target daily --title "Latest build" \
      --notes "Built from commit $REACT_APP_BUILD_ID on $(date '+%Y-%m-%d %H:%M')."; }; then
    echo "Published $built: https://github.com/$RELEASE_REPO/releases/tag/latest"
  else
    echo "Could not publish $built to GitHub (is gh installed and signed in?). The package is here."
  fi
done
