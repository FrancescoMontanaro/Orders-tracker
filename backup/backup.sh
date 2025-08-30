#!/bin/sh
set -eu

# Extract the env variables
MYSQL_HOST="${MYSQL_HOST:-db}"
MYSQL_DATABASE="${MYSQL_DATABASE:-orders}"
MYSQL_USER="${MYSQL_USER:-orders}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-orders}"

# Sentinel file to check if the auto-backup mechanism is working
HEARTBEAT_FILE="${HEARTBEAT_FILE:-/status/last_ok}"

# Set the backup file name and tags
NOW="$(date +%F_%H-%M-%S)"
STDIN_NAME="/mysql/${MYSQL_DATABASE}_${NOW}.sql.gz"
TAGS="mysql,orders-tracker,${MYSQL_DATABASE}"

# Dump the database
echo "[backup] streaming dump of '${MYSQL_DATABASE}' -> restic (${STDIN_NAME})"
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
  | gzip \
  | restic backup --stdin --stdin-filename "${STDIN_NAME}" --tag "${TAGS}"

# Apply retention
echo "[restic] applying retention (forget+prune)"
restic forget --prune \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 6

# Save the backup status to the sentinel file
if [ -n "${HEARTBEAT_FILE}" ]; then
  HB_DIR="$(dirname "${HEARTBEAT_FILE}")"
  mkdir -p "${HB_DIR}"
  TMP_FILE="${HEARTBEAT_FILE}.tmp.$(date +%s)"
  date +%s > "${TMP_FILE}"
  mv -f "${TMP_FILE}" "${HEARTBEAT_FILE}"
  echo "[backup] heartbeat updated at ${HEARTBEAT_FILE}"
fi
echo "[backup] done."