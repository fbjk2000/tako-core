#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: ./scripts/refresh-emergent-patch.sh <upstream_ref> <fixed_ref>" >&2
  echo "Example: ./scripts/refresh-emergent-patch.sh upstream/main emergent-fix" >&2
  exit 64
fi

UPSTREAM_REF="$1"
FIXED_REF="$2"
OUT_PATCH="patches/emergentintegrations-fix.patch"

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT_DIR" ]]; then
  echo "Not inside a git repository." >&2
  exit 1
fi
cd "$ROOT_DIR"

mkdir -p patches

# Keep this list narrow so local policy changes stay explicit and reviewable.
PATCH_FILES=(
  "backend/requirements.txt"
  "backend/server.py"
)

git diff --binary "$UPSTREAM_REF" "$FIXED_REF" -- "${PATCH_FILES[@]}" > "$OUT_PATCH"

if [[ ! -s "$OUT_PATCH" ]]; then
  echo "Generated patch is empty. Did you pick the correct refs?" >&2
  rm -f "$OUT_PATCH"
  exit 1
fi

echo "Patch updated: $OUT_PATCH"
echo "Inspect with: git diff -- $OUT_PATCH"

