#!/bin/bash
# ============================================
# WorkSphere - Database Backup Script
# ============================================
# Usage: ./scripts/backup.sh [environment]

set -euo pipefail

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/worksphere_${ENVIRONMENT}_${TIMESTAMP}.sql.gz"

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    source ".env.${ENVIRONMENT}"
elif [ -f ".env" ]; then
    source ".env"
fi

DB_HOST=${DATABASE_HOST:-localhost}
DB_PORT=${DATABASE_PORT:-5432}
DB_NAME=${DATABASE_NAME:-worksphere}
DB_USER=${DATABASE_USER:-worksphere_user}

echo "========================================"
echo "WorkSphere Database Backup"
echo "========================================"
echo "Environment: ${ENVIRONMENT}"
echo "Database:    ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "Timestamp:   ${TIMESTAMP}"
echo "Output:      ${BACKUP_FILE}"
echo "========================================"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Perform backup
echo "Starting backup..."
PGPASSWORD="${DATABASE_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="${BACKUP_FILE%.gz}" \
    2>&1 | tail -5

# Compress
gzip "${BACKUP_FILE%.gz}" 2>/dev/null || true

# Verify backup
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" 2>/dev/null | cut -f1 || echo "unknown")
echo ""
echo "✅ Backup completed successfully"
echo "   File: ${BACKUP_FILE}"
echo "   Size: ${BACKUP_SIZE}"

# Cleanup old backups (keep last 30 days)
echo ""
echo "Cleaning up backups older than 30 days..."
find "${BACKUP_DIR}" -name "worksphere_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
REMAINING=$(ls -1 "${BACKUP_DIR}"/worksphere_*.sql.gz 2>/dev/null | wc -l || echo "0")
echo "   Remaining backups: ${REMAINING}"
echo "========================================"
