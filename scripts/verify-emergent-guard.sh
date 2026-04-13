#!/usr/bin/env bash
set -euo pipefail

RULE_FILE="patches/emergent-forbidden-patterns.txt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rules)
      RULE_FILE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 64
      ;;
  esac
done

if [[ ! -f "$RULE_FILE" ]]; then
  echo "Rule file not found: $RULE_FILE" >&2
  exit 1
fi

failures=0

while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="$(echo "$raw_line" | sed 's/[[:space:]]*$//')"
  [[ -z "$line" || "$line" == \#* ]] && continue

  scope="${line%%::*}"
  regex="${line#*::}"

  if [[ "$scope" == "$regex" ]]; then
    echo "Invalid rule (expected scope::regex): $line" >&2
    failures=1
    continue
  fi

  if [[ ! -e "$scope" ]]; then
    echo "Rule scope missing, skipping: $scope"
    continue
  fi

  if rg -n --pcre2 --hidden --glob '!.git' -e "$regex" "$scope" >/tmp/emergent_guard_hits.txt; then
    echo "Forbidden pattern found for scope '$scope': /$regex/"
    cat /tmp/emergent_guard_hits.txt
    failures=1
  fi
done < "$RULE_FILE"

rm -f /tmp/emergent_guard_hits.txt

if [[ $failures -ne 0 ]]; then
  echo "Guard verification failed." >&2
  exit 2
fi

echo "Guard verification passed."

