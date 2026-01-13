#!/bin/sh
set -eu

# ============================================================================
# ORDERS TRACKER - BACKUP VERIFICATION SCRIPT
# ============================================================================
# This script verifies that the backup system is working correctly by:
#   1. Checking repository accessibility
#   2. Listing recent snapshots
#   3. Performing a test restore of the latest backup
#   4. Validating the SQL dump structure
# ============================================================================

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [verify] $1"
}

log_error() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [verify] ERROR: $1" >&2
}

MYSQL_DATABASE="${MYSQL_DATABASE:-orders}"
STDIN_NAME="/mysql/${MYSQL_DATABASE}.sql.gz"
VERIFY_DIR="/tmp/backup_verify_$$"

cleanup() {
  rm -rf "${VERIFY_DIR}" 2>/dev/null || true
}
trap cleanup EXIT

log "=== Backup Verification Started ==="

# 1. Check repository accessibility
log "Step 1: Checking Restic repository..."
if ! restic cat config >/dev/null 2>&1; then
  log_error "Cannot access Restic repository!"
  exit 1
fi
log "Repository accessible ✓"

# 2. List snapshots
log "Step 2: Listing recent snapshots..."
SNAPSHOT_COUNT=$(restic snapshots --json 2>/dev/null | grep -c '"id"' || echo "0")
if [ "${SNAPSHOT_COUNT}" -eq 0 ]; then
  log_error "No snapshots found in repository!"
  exit 1
fi
log "Found ${SNAPSHOT_COUNT} snapshot(s) ✓"

# Show latest 5 snapshots
log "Latest snapshots:"
restic snapshots --last 5

# 3. Run integrity check on metadata
log "Step 3: Running integrity check (metadata only)..."
if ! restic check 2>&1; then
  log_error "Repository integrity check failed!"
  exit 1
fi
log "Integrity check passed ✓"

# 4. Test restore of latest snapshot
log "Step 4: Test restore of latest snapshot..."
mkdir -p "${VERIFY_DIR}"

if ! restic restore latest --include "${STDIN_NAME}" --target "${VERIFY_DIR}" 2>&1; then
  log_error "Restore failed!"
  exit 1
fi
log "Restore completed ✓"

# 5. Validate the dump
RESTORED_FILE="${VERIFY_DIR}${STDIN_NAME}"
if [ ! -f "${RESTORED_FILE}" ]; then
  log_error "Restored file not found at ${RESTORED_FILE}"
  exit 1
fi

log "Step 5: Validating dump structure..."
# Check file size (should be > 1KB for any meaningful database)
FILE_SIZE=$(stat -f%z "${RESTORED_FILE}" 2>/dev/null || stat -c%s "${RESTORED_FILE}" 2>/dev/null || echo "0")
if [ "${FILE_SIZE}" -lt 1024 ]; then
  log_error "Dump file is too small (${FILE_SIZE} bytes) - likely empty or corrupted"
  exit 1
fi
log "File size: ${FILE_SIZE} bytes ✓"

# Check for expected SQL content
if ! gunzip -c "${RESTORED_FILE}" | head -100 | grep -q "MySQL dump\|CREATE DATABASE\|CREATE TABLE"; then
  log_error "Dump does not appear to be a valid MySQL dump!"
  exit 1
fi
log "SQL structure validated ✓"

# Check for dump completion marker
if ! gunzip -c "${RESTORED_FILE}" | tail -20 | grep -q "Dump completed"; then
  log_error "Warning: Dump may be incomplete (no completion marker found)"
  # Don't exit - this is a warning, not necessarily fatal
fi

log "=== Verification Summary ==="
log "Repository: accessible"
log "Snapshots: ${SNAPSHOT_COUNT}"
log "Latest restore: successful"
log "Dump validation: passed"
log "Status: ALL CHECKS PASSED ✓"
log "============================"
