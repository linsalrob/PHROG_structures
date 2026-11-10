#!/usr/bin/env bash
# Commit local files onto a remote branch via the GitHub API, without cloning.
# Usage: push_to_branch.sh OWNER/REPO BRANCH "commit message" FILE...   (DRY_RUN=1 to skip the ref update)
set -euo pipefail
REPO=$1 BRANCH=$2 MSG=$3; shift 3

parent=$(gh api "repos/$REPO/git/ref/heads/$BRANCH" --jq .object.sha)
base_tree=$(gh api "repos/$REPO/git/commits/$parent" --jq .tree.sha)

entries=$(for f in "$@"; do
  sha=$(jq -n --arg c "$(base64 -w0 "$f")" '{content:$c, encoding:"base64"}' \
        | gh api "repos/$REPO/git/blobs" --input - --jq .sha)
  mode=100644; [[ -x $f ]] && mode=100755
  jq -n --arg p "$f" --arg s "$sha" --arg m "$mode" '{path:$p, mode:$m, type:"blob", sha:$s}'
done | jq -s .)

tree=$(jq -n --arg b "$base_tree" --argjson t "$entries" '{base_tree:$b, tree:$t}' \
       | gh api "repos/$REPO/git/trees" --input - --jq .sha)
commit=$(jq -n --arg m "$MSG" --arg t "$tree" --arg p "$parent" '{message:$m, tree:$t, parents:[$p]}' \
         | gh api "repos/$REPO/git/commits" --input - --jq .sha)

echo "parent $parent  tree $base_tree -> $tree  commit $commit"
if [[ $tree == "$base_tree" ]]; then echo "No changes; branch not updated."; exit 0; fi
[[ ${DRY_RUN:-0} == 1 ]] && { echo "DRY_RUN: $BRANCH not updated."; exit 0; }
# force=false: fails rather than overwrite if the branch moved meanwhile
gh api -X PATCH "repos/$REPO/git/refs/heads/$BRANCH" -F force=false -f sha="$commit" --jq .object.sha
