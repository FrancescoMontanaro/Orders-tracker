#!/bin/sh
set -eu

# Extract the env variables
MYSQL_HOST="${MYSQL_HOST:-db}"
MYSQL_DATABASE="${MYSQL_DATABASE:-orders}"
MYSQL_USER="${MYSQL_USER:-orders}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-orders}"

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
echo "[backup] done."