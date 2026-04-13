#!/usr/bin/env bash
set -euo pipefail

PATCH_DIR="patches"
REQUIRE_PATCHES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch-dir)
      PATCH_DIR="$2"
      shift 2
      ;;
    --require-patches)
      REQUIRE_PATCHES=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 64
      ;;
  esac
done

if [[ ! -d "$PATCH_DIR" ]]; then
  echo "Patch directory not found: $PATCH_DIR" >&2
  exit 1
fi

PATCHES=()
while IFS= read -r patch_path; do
  PATCHES+=("$patch_path")
done < <(find "$PATCH_DIR" -maxdepth 1 -type f -name '*.patch' | sort)

if [[ ${#PATCHES[@]} -eq 0 ]]; then
  if [[ $REQUIRE_PATCHES -eq 1 ]]; then
    echo "No patch files found in $PATCH_DIR (required)." >&2
    exit 1
  fi
  echo "No patch files found in $PATCH_DIR. Nothing to reapply."
  exit 0
fi

for patch_file in "${PATCHES[@]}"; do
  echo "Reapplying patch: $patch_file"

  if git apply --reverse --check "$patch_file" >/dev/null 2>&1; then
    echo "  already applied, skipping"
    continue
  fi

  if git apply --3way --index "$patch_file"; then
    echo "  applied"
    continue
  fi

  echo "Failed to apply patch: $patch_file" >&2
  echo "Resolve manually on this sync branch, then continue." >&2
  exit 2
done
