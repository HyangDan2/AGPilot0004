#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_FILE="./services/babycare/backend/babycare.db"

if [ -f "$DB_FILE" ]; then
    BACKUP_FILE="${BACKUP_DIR}/babycare_backup_${TIMESTAMP}.sqlite"
    sqlite3 "$DB_FILE" ".backup '${BACKUP_FILE}'"
    echo "✅ SQLite database backup completed: ${BACKUP_FILE}"
else
    echo "⚠️ Database file $DB_FILE not found."
fi
