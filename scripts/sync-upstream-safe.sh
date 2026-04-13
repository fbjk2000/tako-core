#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="main"
UPSTREAM_REMOTE="upstream"
UPSTREAM_BRANCH="main"
UPSTREAM_URL=""
PATCH_DIR="patches"
RULE_FILE="patches/emergent-forbidden-patterns.txt"
AUTO_COMMIT=0

usage() {
  cat <<'EOF'
Safe upstream sync + patch re-apply workflow.

Usage:
  ./scripts/sync-upstream-safe.sh [options]

Options:
  --base-branch <name>      Local integration branch (default: main)
  --upstream-remote <name>  Upstream remote name (default: upstream)
  --upstream-branch <name>  Upstream branch to merge (default: main)
  --upstream-url <url>      Required on first run if upstream remote is missing
  --patch-dir <path>        Patch directory (default: patches)
  --rules <path>            Guard rules file (default: patches/emergent-forbidden-patterns.txt)
  --auto-commit             Auto-commit merge+patch result after guard passes
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-branch)
      BASE_BRANCH="$2"
      shift 2
      ;;
    --upstream-remote)
      UPSTREAM_REMOTE="$2"
      shift 2
      ;;
    --upstream-branch)
      UPSTREAM_BRANCH="$2"
      shift 2
      ;;
    --upstream-url)
      UPSTREAM_URL="$2"
      shift 2
      ;;
    --patch-dir)
      PATCH_DIR="$2"
      shift 2
      ;;
    --rules)
      RULE_FILE="$2"
      shift 2
      ;;
    --auto-commit)
      AUTO_COMMIT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 64
      ;;
  esac
done

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT_DIR" ]]; then
  echo "Not inside a git repository." >&2
  exit 1
fi
cd "$ROOT_DIR"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Working tree is not clean. Commit/stash/discard before syncing." >&2
  exit 1
fi

if [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "Untracked files detected. Commit/stash/clean before syncing." >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BASE_BRANCH" ]]; then
  echo "Checking out base branch: $BASE_BRANCH"
  git checkout "$BASE_BRANCH"
fi

echo "Fetching origin/$BASE_BRANCH"
git fetch origin "$BASE_BRANCH"
git merge --ff-only "origin/$BASE_BRANCH"

if git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
  existing_url="$(git remote get-url "$UPSTREAM_REMOTE")"
  if [[ -n "$UPSTREAM_URL" && "$existing_url" != "$UPSTREAM_URL" ]]; then
    echo "Remote '$UPSTREAM_REMOTE' exists with different URL:" >&2
    echo "  existing: $existing_url" >&2
    echo "  wanted:   $UPSTREAM_URL" >&2
    echo "Update it manually if needed:" >&2
    echo "  git remote set-url $UPSTREAM_REMOTE <new-url>" >&2
    exit 1
  fi
else
  if [[ -z "$UPSTREAM_URL" ]]; then
    echo "Remote '$UPSTREAM_REMOTE' does not exist. Provide --upstream-url on first run." >&2
    exit 1
  fi
  git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi

echo "Fetching $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

SYNC_BRANCH="sync/${UPSTREAM_REMOTE}-${UPSTREAM_BRANCH}-$(date +%Y%m%d-%H%M%S)"
echo "Creating sync branch: $SYNC_BRANCH"
git checkout -b "$SYNC_BRANCH"

echo "Merging $UPSTREAM_REMOTE/$UPSTREAM_BRANCH (no auto-commit)"
if ! git merge --no-ff --no-commit "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"; then
  echo "Merge conflict detected. Resolve on $SYNC_BRANCH, then continue manually." >&2
  exit 2
fi

echo "Reapplying local patches from $PATCH_DIR"
"$ROOT_DIR/scripts/reapply-local-patches.sh" --patch-dir "$PATCH_DIR" --require-patches

echo "Running guard checks"
"$ROOT_DIR/scripts/verify-emergent-guard.sh" --rules "$RULE_FILE"

if [[ $AUTO_COMMIT -eq 1 ]]; then
  git commit -m "sync: merge $UPSTREAM_REMOTE/$UPSTREAM_BRANCH and reapply local patches"
  echo "Auto-commit complete."
else
  echo "Sync prepared on branch: $SYNC_BRANCH"
  echo "Review diff, then commit:"
  echo "  git status"
  echo "  git diff --stat"
  echo "  git commit -m \"sync: merge $UPSTREAM_REMOTE/$UPSTREAM_BRANCH and reapply local patches\""
fi

