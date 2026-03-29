#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# coolify-db-backup.sh — Backup and restore the bandstr PostgreSQL database
#
# Usage:
#   bash scripts/coolify-db-backup.sh backup              # create backup
#   bash scripts/coolify-db-backup.sh restore <file.sql>   # restore from file
#   bash scripts/coolify-db-backup.sh list                 # list backups
#
# Requires SSH access to the Coolify VPS.
# Set VPS_HOST to your server (e.g. user@your-vps.example.com)
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

VPS_HOST="${VPS_HOST:?Set VPS_HOST (e.g. root@vps.trmusic.de)}"
DB_CONTAINER="${DB_CONTAINER:-bandstr-postgres}"
DB_NAME="${DB_NAME:-bandstr}"
DB_USER="${DB_USER:-bandstr}"
BACKUP_DIR="./backups"

ACTION="${1:-help}"

mkdir -p "$BACKUP_DIR"

case "$ACTION" in
    backup)
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="${BACKUP_DIR}/bandstr_${TIMESTAMP}.sql.gz"

        echo "→ Creating backup of '${DB_NAME}' from ${VPS_HOST}..."
        echo "  Container: ${DB_CONTAINER}"
        echo ""

        ssh "$VPS_HOST" \
            "docker exec ${DB_CONTAINER} pg_dump -U ${DB_USER} --clean --if-exists ${DB_NAME}" \
            | gzip > "$BACKUP_FILE"

        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo "  ✓ Backup saved: ${BACKUP_FILE} (${SIZE})"
        ;;

    restore)
        RESTORE_FILE="${2:?Specify backup file to restore (e.g. backups/bandstr_20260326.sql.gz)}"

        if [ ! -f "$RESTORE_FILE" ]; then
            echo "ERROR: File not found: ${RESTORE_FILE}"
            exit 1
        fi

        echo "╔══════════════════════════════════════════════════════╗"
        echo "║  WARNING: This will overwrite the current database  ║"
        echo "╚══════════════════════════════════════════════════════╝"
        echo ""
        echo "  Target:  ${VPS_HOST} → ${DB_CONTAINER}/${DB_NAME}"
        echo "  Source:  ${RESTORE_FILE}"
        echo ""
        read -rp "Type 'yes' to confirm: " CONFIRM

        if [ "$CONFIRM" != "yes" ]; then
            echo "Aborted."
            exit 0
        fi

        echo ""
        echo "→ Restoring..."

        gunzip -c "$RESTORE_FILE" \
            | ssh "$VPS_HOST" \
                "docker exec -i ${DB_CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}"

        echo "  ✓ Restore complete"
        ;;

    list)
        echo "Available backups:"
        echo ""
        ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "  (none)"
        ;;

    *)
        echo "Usage: $0 {backup|restore <file>|list}"
        echo ""
        echo "  backup              Create a compressed backup from the VPS"
        echo "  restore <file>      Restore a backup to the VPS database"
        echo "  list                List local backup files"
        echo ""
        echo "Environment:"
        echo "  VPS_HOST          SSH target (required, e.g. root@vps.trmusic.de)"
        echo "  DB_CONTAINER      Docker container name (default: bandstr-postgres)"
        echo "  DB_NAME           Database name (default: bandstr)"
        echo "  DB_USER           Database user (default: bandstr)"
        ;;
esac
