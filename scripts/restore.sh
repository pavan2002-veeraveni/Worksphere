#!/bin/bash
# ============================================
# WorkSphere - Database Restore Script
# ============================================
# Usage: ./scripts/restore.sh <backup_file> [environment]

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file> [environment]"
    echo "Example: $0 backups/worksphere_production_20241201_120000.sql.gz production"
    exit 1
fi

BACKUP_FILE=$1
ENVIRONMENT=${2:-production}

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
echo "WorkSphere Database Restore"
echo "========================================"
echo "Environment: ${ENVIRONMENT}"
echo "Database:    ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "Backup File: ${BACKUP_FILE}"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will REPLACE all data in ${DB_NAME}!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Decompress if needed
RESTORE_FILE="${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo "Decompressing backup..."
    gunzip -k "${BACKUP_FILE}"
    RESTORE_FILE="${BACKUP_FILE%.gz}"
fi

# Terminate existing connections
echo "Terminating existing connections..."
PGPASSWORD="${DATABASE_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" \
    2>/dev/null || true

# Drop and recreate database
echo "Recreating database..."
PGPASSWORD="${DATABASE_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d postgres \
    -c "DROP DATABASE IF EXISTS ${DB_NAME}; CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

# Restore
echo "Restoring from backup..."
PGPASSWORD="${DATABASE_PASSWORD}" pg_restore \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --verbose \
    --no-owner \
    --no-privileges \
    "${RESTORE_FILE}" \
    2>&1 | tail -10

# Cleanup decompressed file
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    rm -f "${RESTORE_FILE}"
fi

# Verify
echo ""
echo "Verifying restore..."
TABLE_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "✅ Restore completed successfully"
echo "   Tables restored: ${TABLE_COUNT}"
echo "========================================"
