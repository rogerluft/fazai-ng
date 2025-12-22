#!/bin/bash
###############################################################################
# FazAI Qdrant Backup Cleanup Script
#
# Removes old Qdrant backups based on retention policy
#
# Installation:
#   sudo cp scripts/cleanup-qdrant-backups.sh /opt/fazai/scripts/
#   sudo chmod +x /opt/fazai/scripts/cleanup-qdrant-backups.sh
#
# Usage:
#   /opt/fazai/scripts/cleanup-qdrant-backups.sh [RETENTION_DAYS]
#
# Examples:
#   ./cleanup-qdrant-backups.sh           # Use default (7 days)
#   ./cleanup-qdrant-backups.sh 14        # Keep last 14 days
###############################################################################

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/fazai/qdrant"
DEFAULT_RETENTION_DAYS=7
RETENTION_DAYS="${1:-$DEFAULT_RETENTION_DAYS}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Validate retention days argument
if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}Error:${NC} RETENTION_DAYS must be a positive integer"
    echo "Usage: $0 [RETENTION_DAYS]"
    exit 1
fi

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}Warning:${NC} Backup directory does not exist: $BACKUP_DIR"
    exit 0
fi

echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}FazAI Qdrant Backup Cleanup${NC}"
echo -e "${CYAN}=======================================${NC}"
echo ""
echo "Backup Directory: $BACKUP_DIR"
echo "Retention Policy: Keep last $RETENTION_DAYS days"
echo ""

# Count total backups before cleanup
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -type f -name "*.backup.json" 2>/dev/null | wc -l)
echo -e "${CYAN}Total backups:${NC} $TOTAL_BACKUPS"

# Find old backups
echo ""
echo -e "${YELLOW}Searching for backups older than $RETENTION_DAYS days...${NC}"

OLD_BACKUPS=()
while IFS= read -r -d '' backup_file; do
    OLD_BACKUPS+=("$backup_file")
done < <(find "$BACKUP_DIR" -type f -name "*.backup.json" -mtime +"$RETENTION_DAYS" -print0 2>/dev/null)

OLD_COUNT="${#OLD_BACKUPS[@]}"

if [ "$OLD_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No old backups found. Nothing to delete."
    echo ""
    echo -e "${CYAN}Current disk usage:${NC} $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
    exit 0
fi

# Display old backups
echo ""
echo -e "${YELLOW}Found $OLD_COUNT old backup(s):${NC}"
for backup in "${OLD_BACKUPS[@]}"; do
    FILE_SIZE=$(du -h "$backup" 2>/dev/null | cut -f1)
    FILE_AGE=$(find "$backup" -mtime +"$RETENTION_DAYS" -printf '%Td days old\n' 2>/dev/null)
    echo "  - $(basename "$backup") ($FILE_SIZE, $FILE_AGE)"
done

# Calculate total size to be freed
TOTAL_SIZE=0
for backup in "${OLD_BACKUPS[@]}"; do
    SIZE_KB=$(du -k "$backup" 2>/dev/null | cut -f1)
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE_KB))
done
TOTAL_SIZE_MB=$((TOTAL_SIZE / 1024))

echo ""
echo -e "${YELLOW}Space to be freed:${NC} ${TOTAL_SIZE_MB}MB"

# Confirm deletion (if interactive)
if [ -t 0 ]; then
    read -rp "Delete these backups? (y/N): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Cancelled.${NC}"
        exit 0
    fi
fi

# Delete old backups
echo ""
echo -e "${CYAN}Deleting old backups...${NC}"

DELETED_COUNT=0
FAILED_COUNT=0

for backup in "${OLD_BACKUPS[@]}"; do
    if rm -f "$backup" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Deleted: $(basename "$backup")"
        ((DELETED_COUNT++))
    else
        echo -e "  ${RED}✗${NC} Failed to delete: $(basename "$backup")"
        ((FAILED_COUNT++))
    fi
done

# Summary
echo ""
echo -e "${CYAN}=======================================${NC}"
echo -e "${CYAN}Cleanup Summary${NC}"
echo -e "${CYAN}=======================================${NC}"
echo -e "${GREEN}Deleted:${NC} $DELETED_COUNT file(s)"

if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "${RED}Failed:${NC} $FAILED_COUNT file(s)"
fi

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -type f -name "*.backup.json" 2>/dev/null | wc -l)
echo -e "${CYAN}Remaining backups:${NC} $REMAINING_BACKUPS"
echo -e "${CYAN}Disk usage:${NC} $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
echo -e "${CYAN}Space freed:${NC} ${TOTAL_SIZE_MB}MB"
echo ""

if [ "$FAILED_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ Cleanup completed successfully${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Cleanup completed with errors${NC}"
    exit 1
fi
