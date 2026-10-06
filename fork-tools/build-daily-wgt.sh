#!/bin/bash
# Builds the Tizen package for daily use. Only the daily folder builds packages, and they are
# never committed (*.wgt is ignored). It is the regular build, not --oblong or --legacy, and it is
# named after the upstream package with _Lica_Fork added:
#   Moonfin_Tizen_Regular_<version>_Lica_Fork.wgt
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
