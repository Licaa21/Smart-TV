#!/bin/bash
# Brings upstream and my own changes together in the daily branch. Run it in the daily folder:
#   bash fork-tools/update-daily.sh
# main takes upstream first, then daily takes main and implement. If a merge conflicts, git stops
# and says where: fix the files, commit, and run this again.
set -e
cd "$(git rev-parse --show-toplevel)"
[ "$(git branch --show-current)" = "daily" ] || { echo "Run this on the daily branch."; exit 1; }
MAIN_DIR="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
git fetch origin
git fetch upstream
git -C "$MAIN_DIR" merge --no-edit upstream/main
git -C "$MAIN_DIR" push origin main
git merge --no-edit origin/main
git merge --no-edit origin/implement
# The accent rules are generated from the stylesheets, so they are rebuilt after every merge.
node scripts/gen-accent-rules.js
git add -A
git commit -m "Regenerate accent rules" || true
git push origin daily
echo "daily is up to date. Build the app with: bash fork-tools/build-daily-wgt.sh"
