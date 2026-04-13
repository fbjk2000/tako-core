# Local Patch Workflow (Emergent Sync Safety)

This directory holds local patches that must survive upstream syncs.

## Required files
- `emergentintegrations-fix.patch` — your local fix patch
- `emergent-forbidden-patterns.txt` — guard rules that fail sync if forbidden patterns return

## One-time bootstrap
1. Put your known-good fix on a branch (example: `emergent-fix`).
2. Generate patch file:
   ```bash
   ./scripts/refresh-emergent-patch.sh upstream/main emergent-fix
   ```
3. Verify patch applies cleanly:
   ```bash
   ./scripts/reapply-local-patches.sh --patch-dir patches --require-patches
   git reset --hard HEAD
   ```

## Ongoing sync
Use:
```bash
./scripts/sync-upstream-safe.sh --upstream-url <EMERGENT_REPO_URL>
```
After first run, `--upstream-url` is optional if `upstream` remote already exists.

