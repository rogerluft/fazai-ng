#!/usr/bin/env bash
# FazAI Source Code Backup Utility
# Creates a timestamped tarball of the project source code.

BACKUP_DIR="/opt/fazai/backups/code"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/fazai-source-${TIMESTAMP}.tar.gz"

echo "📦 Starting Source Code Backup..."

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Archive the project (excluding node_modules, .git, etc.)
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='coverage' \
    -czf "${BACKUP_FILE}" .

if [ $? -eq 0 ]; then
    echo "✅ Backup created successfully: ${BACKUP_FILE}"
    echo "📊 Size: $(du -h "${BACKUP_FILE}" | cut -f1)"
else
    echo "❌ Backup failed!"
    exit 1
fi
