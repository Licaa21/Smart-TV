#!/bin/bash
# Brings upstream Moonfin into this fork's daily branch. Run it from a clean checkout of daily:
#   bash fork-tools/update-from-upstream.sh
# If the merge conflicts, git stops and says where. Fix the files, commit, and run it again.
set -e
cd "$(git rev-parse --show-toplevel)"
git fetch upstream
git merge --no-edit upstream/main
# The accent rules are generated from the stylesheets, so they are rebuilt after every merge.
node scripts/gen-accent-rules.js
git add -A
git commit -m "Regenerate accent rules" || true
echo "daily now includes upstream main. Push with: git push origin daily"
