#!/bin/bash
###############################################################################
# FazAI Qdrant Backup Script
#
# Automated daily backup script for Qdrant collections
#
# Installation:
#   sudo cp scripts/backup-qdrant.sh /opt/fazai/scripts/
#   sudo chmod +x /opt/fazai/scripts/backup-qdrant.sh
#
# Cron setup (daily at 2 AM):
#   sudo crontab -e
#   0 2 * * * /opt/fazai/scripts/backup-qdrant.sh >> /var/log/fazai/qdrant-backup.log 2>&1
#
# Manual execution:
#   /opt/fazai/scripts/backup-qdrant.sh
###############################################################################

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
BACKUP_DIR="/var/backups/fazai/qdrant"
LOG_FILE="/var/log/fazai/qdrant-backup.log"
RETENTION_DAYS=7
FAZAI_BIN="/usr/local/bin/fazai"

# Colors for output (ANSI escape codes)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case "$level" in
        INFO)
            echo -e "${GREEN}[INFO]${NC} ${timestamp} - ${message}" | tee -a "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} ${timestamp} - ${message}" | tee -a "$LOG_FILE"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} ${timestamp} - ${message}" | tee -a "$LOG_FILE"
            ;;
        *)
            echo "${timestamp} - ${message}" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Check if fazai is installed
if [ ! -f "$FAZAI_BIN" ]; then
    log ERROR "FazAI binary not found at $FAZAI_BIN"
    exit 1
fi

# Check if Qdrant is available
if ! "$FAZAI_BIN" qdrant status &>/dev/null; then
    log ERROR "Qdrant is not available. Skipping backup."
    exit 1
fi

# Main backup execution
log INFO "========================================="
log INFO "Starting FazAI Qdrant backup"
log INFO "========================================="

# Run backup
if "$FAZAI_BIN" qdrant backup; then
    log INFO "Backup completed successfully"
    BACKUP_SUCCESS=true
else
    log ERROR "Backup failed with exit code $?"
    BACKUP_SUCCESS=false
fi

# Cleanup old backups (keep last RETENTION_DAYS days)
log INFO "Cleaning up backups older than $RETENTION_DAYS days..."

if [ -d "$BACKUP_DIR" ]; then
    # Find and delete backups older than retention period
    DELETED_COUNT=0
    while IFS= read -r -d '' backup_file; do
        log INFO "Deleting old backup: $backup_file"
        rm -f "$backup_file"
        ((DELETED_COUNT++))
    done < <(find "$BACKUP_DIR" -type f -name "*.backup.json" -mtime +"$RETENTION_DAYS" -print0)

    if [ "$DELETED_COUNT" -gt 0 ]; then
        log INFO "Deleted $DELETED_COUNT old backup(s)"
    else
        log INFO "No old backups to delete"
    fi
else
    log WARN "Backup directory does not exist: $BACKUP_DIR"
fi

# Report disk usage
if [ -d "$BACKUP_DIR" ]; then
    DISK_USAGE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log INFO "Total backup disk usage: $DISK_USAGE"
fi

# Final status
log INFO "========================================="
if [ "$BACKUP_SUCCESS" = true ]; then
    log INFO "Backup process completed successfully"
    exit 0
else
    log ERROR "Backup process failed"
    exit 1
fi
