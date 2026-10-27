#!/bin/bash
# Builds the Tizen package for daily use. Only the daily folder builds packages, and they are
# never committed (*.wgt is ignored). It is the regular build, not --oblong or --legacy, and it is
# named after the upstream package with _Lica_Fork added:
#   Moonfin_Tizen_Regular_<version>_Lica_Fork.wgt
# It is then published as a release of its own (fork-tools/publish-wgt.sh), and the releases are kept.
set -e
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = "daily" ] || { echo "Packages are only built on the daily branch."; exit 1; }
# The commit the package is built from, printed in the diagnostic report so a log says which build made it
export REACT_APP_BUILD_ID="$(git rev-parse --short HEAD)"
# The fork's version of this build, worked out before it is compiled so the app knows it and can watch the fork's releases for a newer one
forkversion="$(bash fork-tools/publish-wgt.sh --version)"
[ -z "$forkversion" ] || export REACT_APP_FORK_VERSION="$forkversion" FORK_VERSION="$forkversion"
# The TV and the TV-Store show the version in config.xml, so the package carries the fork's. The file goes back to what is
# committed when the build ends (publish-wgt.sh puts the version on main once the release is out).
config=packages/build-tizen/tizen/config.xml
if [ -n "$forkversion" ]; then
  trap 'git checkout -- "$config" 2>/dev/null || true' EXIT
  sed -i -E "s/(<widget [^>]* version=\")[0-9.]+(\")/\1$forkversion\2/" "$config"
  grep -q "<widget [^>]* version=\"$forkversion\"" "$config" || { echo "config.xml did not take the version $forkversion."; exit 1; }
fi
npm run build:tizen
for built in Moonfin_Tizen_Regular_*.wgt; do
  case "$built" in
    *_Lica_Fork.wgt|*_Lica_Fork_v[0-9]*.wgt) ;;
    *) mv -f "$built" "${built%.wgt}_Lica_Fork.wgt"; echo "Built ${built%.wgt}_Lica_Fork.wgt" ;;
  esac
done
# The package goes on GitHub as a release of its own, named by the fork's version and described by what was committed
# since the last one. A failed upload does not undo the build, the package is still here.
bash fork-tools/publish-wgt.sh || echo "The package was built but not published. Run: bash fork-tools/publish-wgt.sh"
