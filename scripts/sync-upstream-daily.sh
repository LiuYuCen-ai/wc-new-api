#!/usr/bin/env bash
# Sync QuantumNous/new-api (upstream) into local main, then push to GitHub + Gitee.
#
# Local usage (from repo root):
#   ./scripts/sync-upstream-daily.sh
#
# Required remotes:
#   upstream  -> https://github.com/QuantumNous/new-api.git
#   github    -> git@github.com:LiuYuCen-ai/wc-new-api.git
#   origin    -> https://gitee.com/liuyucen/new-abroad.git
#
# On merge conflict the script aborts the merge and exits non-zero.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-main}"
GITHUB_REMOTE="${GITHUB_REMOTE:-github}"
GITEE_REMOTE="${GITEE_REMOTE:-origin}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
MERGE_MSG="chore: sync upstream QuantumNous/new-api $(date -u +%Y-%m-%d)"

require_remote() {
  local name="$1"
  if ! git remote get-url "$name" >/dev/null 2>&1; then
    echo "Missing git remote: $name" >&2
    exit 1
  fi
}

require_remote "$UPSTREAM_REMOTE"
require_remote "$GITHUB_REMOTE"
require_remote "$GITEE_REMOTE"

git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"
git fetch "$GITHUB_REMOTE" "$TARGET_BRANCH" || true
git fetch "$GITEE_REMOTE" "$TARGET_BRANCH" || true

git checkout "$TARGET_BRANCH"
git pull --ff-only "$GITHUB_REMOTE" "$TARGET_BRANCH" 2>/dev/null || true

if git merge-base --is-ancestor "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" HEAD; then
  echo "Already up to date with $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
else
  echo "Merging $UPSTREAM_REMOTE/$UPSTREAM_BRANCH into $TARGET_BRANCH ..."
  if ! git merge "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" -m "$MERGE_MSG" --no-edit; then
    git merge --abort
    echo "Merge conflict with upstream. Resolve manually, then push." >&2
    exit 1
  fi
fi

echo "Pushing to GitHub ($GITHUB_REMOTE) ..."
git push "$GITHUB_REMOTE" "$TARGET_BRANCH"

echo "Pushing to Gitee ($GITEE_REMOTE) ..."
git push "$GITEE_REMOTE" "$TARGET_BRANCH"

echo "Done. Synced $TARGET_BRANCH to GitHub and Gitee."
