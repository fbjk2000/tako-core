#!/bin/bash
# backup-mongo.sh — daily MongoDB snapshot (FOLLOWUPS #15).
#
# Intended use: cron, once a day. Dumps the tako database, tars it, retains
# the last 7 days on disk. Safe to run under a locked-down service user —
# the only writable path is $BACKUP_DIR.
#
# Env overrides:
#   BACKUP_DIR   — where to write archives (default /opt/tako/backups)
#   MONGO_URL    — source connection string (default mongodb://localhost:27017)
#   DB_NAME      — database to dump (default tako)
#
# Exit codes: non-zero on any failure (set -e). Pair with >>/var/log and the
# cron MAILTO to get notified when a backup fails.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/tako/backups}"
MONGO_URL="${MONGO_URL:-mongodb://localhost:27017}"
DB_NAME="${DB_NAME:-tako}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
echo "[$(date)] Starting backup: tako_$TIMESTAMP"

mongodump --uri="$MONGO_URL" --db="$DB_NAME" --out="$BACKUP_DIR/tako_$TIMESTAMP" --quiet

# Compress: tar from inside $BACKUP_DIR so the archive doesn't embed the
# absolute path (makes restore onto a different host easier).
tar -czf "$BACKUP_DIR/tako_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "tako_$TIMESTAMP"
rm -rf "$BACKUP_DIR/tako_$TIMESTAMP"

# Retain 7 days of archives. 2>/dev/null || true so the very first run
# (when nothing matches) doesn't error out under set -e.
find "$BACKUP_DIR" -name "tako_*.tar.gz" -mtime +7 -delete 2>/dev/null || true

SIZE=$(du -h "$BACKUP_DIR/tako_$TIMESTAMP.tar.gz" | cut -f1)
echo "[$(date)] Backup complete: tako_$TIMESTAMP.tar.gz ($SIZE)"

# TODO: offsite upload — uncomment and configure AWS creds on the VPS:
#   aws s3 cp "$BACKUP_DIR/tako_$TIMESTAMP.tar.gz" "s3://tako-backups/"
# Until that lands, rely on the host's own disk-level snapshots for DR.
