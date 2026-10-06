#!/bin/bash
# Rebuilds fork/daily from upstream main plus every branch listed in pr-branches.txt, then
# regenerates the accent rules. Run it from a clean checkout of this branch:
#   bash fork-tools/rebuild-daily.sh
# It never touches the PR branches. If a merge conflicts it stops and names the branch, and the
# fix belongs on that PR branch (merge upstream/main into it), after which this runs clean again.
set -e
cd "$(git rev-parse --show-toplevel)"
git fetch origin
git fetch upstream
LIST=$(grep -v '^#' fork-tools/pr-branches.txt | grep -v '^$')
KEEP=$(mktemp -d)
cp -r fork-tools "$KEEP/"
git reset --hard upstream/main
cp -r "$KEEP/fork-tools" .
for b in $LIST; do
  if git merge --no-edit "origin/$b" > /dev/null 2>&1; then
    echo "merged   $b"
  else
    echo "CONFLICT $b"
    git merge --abort
    echo "Merge upstream/main into $b, push it, and run this again."
    exit 1
  fi
done
node scripts/gen-accent-rules.js
git add -A
git commit -m "Fork tools and regenerated accent rules" || true
echo "fork/daily is upstream main + $(echo "$LIST" | wc -l) branches"
