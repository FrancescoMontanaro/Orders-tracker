#!/bin/sh
set -eu

# ============================================================================
# ORDERS TRACKER - DATABASE BACKUP SCRIPT
# ============================================================================
# This script performs:
#   1. MySQL dump with consistency guarantees
#   2. Compressed backup to Restic (S3)
#   3. Retention policy enforcement with prune
#   4. Periodic integrity verification
#   5. Heartbeat update for sentinel monitoring
# ============================================================================

# ----------------------------- Configuration --------------------------------

MYSQL_HOST="${MYSQL_HOST:-db}"
MYSQL_DATABASE="${MYSQL_DATABASE:-orders}"
MYSQL_USER="${MYSQL_USER:-orders}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-orders}"

# Sentinel heartbeat file
HEARTBEAT_FILE="${HEARTBEAT_FILE:-/status/last_ok}"

# Restic settings
RESTIC_HOST_TAG="${RESTIC_HOST:-orders-db-backup}"
STDIN_NAME="/mysql/${MYSQL_DATABASE}.sql.gz"

# Integrity check: run every N backups (default: every 6 backups = ~3 days with 2/day)
CHECK_INTERVAL="${BACKUP_CHECK_INTERVAL:-6}"
CHECK_COUNTER_FILE="${CHECK_COUNTER_FILE:-/status/backup_counter}"

# -------------------------------- Helpers -----------------------------------

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [backup] $1"
}

log_error() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [backup] ERROR: $1" >&2
}

die() {
  log_error "$1"
  exit 1
}

# Increment and return the backup counter (for periodic integrity checks)
get_and_increment_counter() {
  local counter=0
  if [ -f "${CHECK_COUNTER_FILE}" ]; then
    counter=$(cat "${CHECK_COUNTER_FILE}" 2>/dev/null || echo "0")
    # Validate it's a number
    case "$counter" in
      ''|*[!0-9]*) counter=0 ;;
    esac
  fi
  counter=$((counter + 1))
  echo "$counter" > "${CHECK_COUNTER_FILE}"
  echo "$counter"
}

# ----------------------------- Pre-flight checks ----------------------------

log "Starting backup for database '${MYSQL_DATABASE}'"

# Verify MySQL connectivity before starting
log "Verifying MySQL connectivity..."
if ! mysqladmin ping \
  --host="${MYSQL_HOST}" \
  --user="${MYSQL_USER}" \
  --password="${MYSQL_PASSWORD}" \
  --silent 2>/dev/null; then
  die "Cannot connect to MySQL at ${MYSQL_HOST}"
fi
log "MySQL connection OK"

# Verify Restic repository is accessible
log "Verifying Restic repository access..."
if ! restic cat config >/dev/null 2>&1; then
  die "Cannot access Restic repository. Check RESTIC_REPOSITORY and credentials."
fi
log "Restic repository OK"

# ------------------------------- MySQL Dump ---------------------------------

log "Starting MySQL dump -> gzip -> Restic (${STDIN_NAME})"

# Create a temporary file to capture any dump errors
DUMP_STDERR=$(mktemp)
trap "rm -f '${DUMP_STDERR}'" EXIT

# Perform the dump with verification
# We use a subshell to capture the exit status of mysqldump specifically
if ! (
  mysqldump \
    --host="${MYSQL_HOST}" \
    --user="${MYSQL_USER}" \
    --password="${MYSQL_PASSWORD}" \
    --single-transaction \
    --routines \
    --events \
    --triggers \
    --no-tablespaces \
    --databases "${MYSQL_DATABASE}" \
    --result-file=/dev/stdout \
    2>"${DUMP_STDERR}" \
  | gzip \
  | restic backup --stdin --stdin-filename "${STDIN_NAME}" \
      --tag mysql --tag orders-tracker --tag "${MYSQL_DATABASE}" \
      --host "${RESTIC_HOST_TAG}"
); then
  # Check if there were MySQL errors
  if [ -s "${DUMP_STDERR}" ]; then
    log_error "MySQL dump errors:"
    cat "${DUMP_STDERR}" >&2
  fi
  die "Backup pipeline failed"
fi

# Check for MySQL warnings/errors (non-fatal but important)
if [ -s "${DUMP_STDERR}" ]; then
  log "MySQL dump warnings (non-fatal):"
  cat "${DUMP_STDERR}"
fi

log "Backup completed successfully"

# ----------------------------- Retention Policy -----------------------------

log "Applying retention policy (forget + prune)..."
if ! restic forget \
  --prune \
  --group-by host,tags \
  --host "${RESTIC_HOST_TAG}" \
  --tag mysql --tag orders-tracker --tag "${MYSQL_DATABASE}" \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6; then
  log_error "Retention policy failed, but backup was successful"
  # Don't exit - backup was successful, heartbeat should still be updated
fi

log "Retention policy applied"

# ------------------------- Periodic Integrity Check -------------------------

COUNTER=$(get_and_increment_counter)
log "Backup counter: ${COUNTER}/${CHECK_INTERVAL}"

if [ "$((COUNTER % CHECK_INTERVAL))" -eq 0 ]; then
  log "Running periodic integrity check..."
  if restic check --read-data-subset=5% 2>&1; then
    log "Integrity check PASSED"
  else
    log_error "Integrity check FAILED - repository may be corrupted!"
    # Still update heartbeat since backup succeeded, but this is logged
  fi
fi

# ------------------------------ Heartbeat -----------------------------------

if [ -n "${HEARTBEAT_FILE}" ]; then
  HB_DIR="$(dirname "${HEARTBEAT_FILE}")"
  mkdir -p "${HB_DIR}"
  
  # Atomic write using temp file + mv
  TMP_FILE="${HEARTBEAT_FILE}.tmp.$$"
  date +%s > "${TMP_FILE}"
  mv -f "${TMP_FILE}" "${HEARTBEAT_FILE}"
  
  log "Heartbeat updated at ${HEARTBEAT_FILE}"
fi

# ------------------------------- Summary ------------------------------------

log "=== Backup Summary ==="
log "Database: ${MYSQL_DATABASE}"
log "Target: ${STDIN_NAME}"
log "Status: SUCCESS"
log "======================"
