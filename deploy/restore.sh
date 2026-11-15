#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DB="./services/babycare/backend/babycare.db"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "Usage: ./deploy/restore.sh <backup_file_path>"
    exit 1
fi

echo "Restoring database from $BACKUP_FILE to $TARGET_DB..."
cp "$BACKUP_FILE" "$TARGET_DB"
echo "✅ Database restored successfully."
