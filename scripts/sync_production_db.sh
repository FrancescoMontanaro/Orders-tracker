#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DATABASE_DIR="${ROOT_DIR}/database"
DUMP_DIR="${ROOT_DIR}/database_dumps"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

SSH_TARGET=""
SSH_PORT=""
REMOTE_DIR=""
OUTPUT_FILE=""
ASSUME_YES=0

LOCAL_BACKUP_DIR=""
DATADIR_SWAPPED=0
TEMP_DUMP=""

usage() {
  cat <<'EOF'
Scarica un dump MySQL dalla produzione via SSH e sostituisce il database locale.

Uso:
  ./scripts/sync_production_db.sh \
    --ssh utente@server \
    --remote-dir '/percorso/Orders-tracker'

Opzioni:
  --ssh TARGET       Host SSH, per esempio deploy@example.com (obbligatorio)
  --ssh-port PORTA   Porta SSH personalizzata
  --remote-dir DIR   Directory remota contenente docker-compose.yml (obbligatoria).
                     Per usare la home remota, quotare: '~/Orders-tracker'
  --output FILE      Percorso del file .sql.gz locale
  --yes              Non richiede conferma interattiva
  -h, --help         Mostra questo aiuto

Lo script:
  1. esegue mysqldump nel container remoto "db";
  2. comprime e salva il dump in database_dumps/;
  3. ferma i container locali;
  4. rinomina database/ in database.before-sync-<timestamp>/;
  5. inizializza un database locale pulito e importa il dump;
  6. lascia avviato soltanto il servizio db.

Il precedente database locale non viene eliminato. In caso di errore durante
l'avvio o l'importazione, lo script prova a ripristinarlo automaticamente.
EOF
}

log() {
  printf '==> %s\n' "$*"
}

die() {
  printf 'Errore: %s\n' "$*" >&2
  if [[ "${DATADIR_SWAPPED}" -eq 1 ]]; then
    rollback_local_database 1
  fi
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Comando richiesto non trovato: $1"
}

rollback_local_database() {
  local exit_code="$1"
  trap - ERR

  if [[ "${DATADIR_SWAPPED}" -ne 1 ]]; then
    exit "${exit_code}"
  fi

  printf '\nErrore durante la sostituzione del database locale. Avvio rollback...\n' >&2
  (
    cd "${ROOT_DIR}"
    docker compose stop db >/dev/null 2>&1 || true

    if [[ -d "${LOCAL_DATABASE_DIR}" ]]; then
      local failed_dir="${ROOT_DIR}/database.failed-sync-${TIMESTAMP}"
      mv "${LOCAL_DATABASE_DIR}" "${failed_dir}"
      printf 'Datadir non riuscito conservato in: %s\n' "${failed_dir}" >&2
    fi

    if [[ -n "${LOCAL_BACKUP_DIR}" && -d "${LOCAL_BACKUP_DIR}" ]]; then
      mv "${LOCAL_BACKUP_DIR}" "${LOCAL_DATABASE_DIR}"
      docker compose up -d db >/dev/null
      printf 'Database locale precedente ripristinato e riavviato.\n' >&2
    else
      mkdir -p "${LOCAL_DATABASE_DIR}"
      printf 'Non era presente un database locale precedente da ripristinare.\n' >&2
    fi
  ) || printf 'Rollback automatico incompleto: controllare manualmente le directory database.*\n' >&2

  exit "${exit_code}"
}

cleanup_temp_dump() {
  if [[ -n "${TEMP_DUMP}" && -f "${TEMP_DUMP}" ]]; then
    rm -f "${TEMP_DUMP}"
  fi
}

wait_for_local_database() {
  local container_id status attempt
  container_id="$(docker compose ps -q db)"
  [[ -n "${container_id}" ]] || return 1

  for attempt in $(seq 1 60); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"
    if [[ "${status}" == "healthy" ]]; then
      return 0
    fi
    if [[ "${status}" == "exited" || "${status}" == "dead" ]]; then
      break
    fi
    sleep 2
  done

  docker compose logs --no-color --tail=100 db >&2 || true
  return 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ssh)
      [[ $# -ge 2 ]] || die "Valore mancante per --ssh"
      SSH_TARGET="$2"
      shift 2
      ;;
    --ssh-port)
      [[ $# -ge 2 ]] || die "Valore mancante per --ssh-port"
      SSH_PORT="$2"
      shift 2
      ;;
    --remote-dir)
      [[ $# -ge 2 ]] || die "Valore mancante per --remote-dir"
      REMOTE_DIR="$2"
      shift 2
      ;;
    --output)
      [[ $# -ge 2 ]] || die "Valore mancante per --output"
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --yes)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "Opzione sconosciuta: $1"
      ;;
  esac
done

[[ -n "${SSH_TARGET}" ]] || die "--ssh è obbligatorio"
[[ -n "${REMOTE_DIR}" ]] || die "--remote-dir è obbligatorio"
[[ "${SSH_TARGET}" != -* ]] || die "Target SSH non valido"
if [[ "${REMOTE_DIR}" != /* && "${REMOTE_DIR}" != "~" && "${REMOTE_DIR}" != "~/"* ]]; then
  die "--remote-dir deve essere assoluto oppure iniziare con ~/ (tra apici)"
fi

if [[ -n "${SSH_PORT}" ]]; then
  [[ "${SSH_PORT}" =~ ^[0-9]+$ ]] || die "La porta SSH deve essere numerica"
fi

require_command ssh
require_command docker
require_command gzip
require_command mktemp

if [[ -z "${OUTPUT_FILE}" ]]; then
  OUTPUT_FILE="${DUMP_DIR}/orders_tracker_production_${TIMESTAMP}.sql.gz"
elif [[ "${OUTPUT_FILE}" != /* ]]; then
  OUTPUT_FILE="${ROOT_DIR}/${OUTPUT_FILE}"
fi

[[ "${OUTPUT_FILE}" == *.sql.gz ]] || die "Il file di output deve terminare con .sql.gz"
mkdir -p "$(dirname "${OUTPUT_FILE}")"
[[ ! -e "${OUTPUT_FILE}" ]] || die "Il file di output esiste già: ${OUTPUT_FILE}"

cd "${ROOT_DIR}"
docker compose config --quiet

printf '\nATTENZIONE\n'
printf '  Produzione SSH: %s\n' "${SSH_TARGET}"
printf '  Progetto remoto: %s\n' "${REMOTE_DIR}"
printf '  Dump locale:     %s\n' "${OUTPUT_FILE}"
printf '  Database locale: %s (verrà sostituito, ma conservato come backup)\n\n' "${LOCAL_DATABASE_DIR}"

if [[ "${ASSUME_YES}" -ne 1 ]]; then
  [[ -t 0 ]] || die "Esecuzione non interattiva: aggiungere --yes per confermare"
  read -r -p "Scrivi IMPORTA per continuare: " confirmation
  [[ "${confirmation}" == "IMPORTA" ]] || die "Operazione annullata"
fi

trap cleanup_temp_dump EXIT
trap 'rollback_local_database $?' ERR

TEMP_DUMP="$(mktemp "${OUTPUT_FILE}.partial.XXXXXX")"
if [[ "${REMOTE_DIR}" == "~" ]]; then
  remote_dir_quoted='"$HOME"'
elif [[ "${REMOTE_DIR}" == "~/"* ]]; then
  printf -v remote_relative_dir_quoted '%q' "${REMOTE_DIR#\~/}"
  remote_dir_quoted="\"\$HOME\"/${remote_relative_dir_quoted}"
else
  printf -v remote_dir_quoted '%q' "${REMOTE_DIR}"
fi

remote_dump_command="cd ${remote_dir_quoted} && docker compose exec -T db sh -c 'MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" exec mysqldump --user=root --single-transaction --quick --routines --events --triggers --hex-blob --no-tablespaces --set-gtid-purged=OFF --default-character-set=utf8mb4 --databases \"\$MYSQL_DATABASE\"'"

run_remote_dump() {
  if [[ -n "${SSH_PORT}" ]]; then
    ssh -p "${SSH_PORT}" -- "${SSH_TARGET}" "${remote_dump_command}"
  else
    ssh -- "${SSH_TARGET}" "${remote_dump_command}"
  fi
}

log "Creazione del dump sul database di produzione via SSH..."
run_remote_dump | gzip -c > "${TEMP_DUMP}"

[[ -s "${TEMP_DUMP}" ]] || die "Il dump ricevuto è vuoto"
gzip -t "${TEMP_DUMP}"
mv "${TEMP_DUMP}" "${OUTPUT_FILE}"
TEMP_DUMP=""
log "Dump salvato e verificato: ${OUTPUT_FILE} ($(du -h "${OUTPUT_FILE}" | awk '{print $1}'))"

log "Arresto dei container locali prima della sostituzione..."
docker compose stop

if [[ -d "${LOCAL_DATABASE_DIR}" ]]; then
  LOCAL_BACKUP_DIR="${ROOT_DIR}/database.before-sync-${TIMESTAMP}"
  [[ ! -e "${LOCAL_BACKUP_DIR}" ]] || die "Directory di backup già esistente: ${LOCAL_BACKUP_DIR}"
  mv "${LOCAL_DATABASE_DIR}" "${LOCAL_BACKUP_DIR}"
  log "Database locale precedente conservato in: ${LOCAL_BACKUP_DIR}"
fi

mkdir -p "${LOCAL_DATABASE_DIR}"
DATADIR_SWAPPED=1

log "Inizializzazione di un database MySQL locale pulito..."
docker compose up -d db
wait_for_local_database || die "Il nuovo database locale non è diventato healthy"

log "Importazione del dump nel database locale..."
gzip -dc "${OUTPUT_FILE}" \
  | docker compose exec -T db sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root --default-character-set=utf8mb4'

table_count="$(
  docker compose exec -T db sh -c \
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --user=root --batch --skip-column-names "$MYSQL_DATABASE" --execute="SHOW TABLES"' \
  | awk 'NF { count += 1 } END { print count + 0 }'
)"

[[ "${table_count}" -gt 0 ]] || die "Import completato senza errori, ma nel database non risultano tabelle"

DATADIR_SWAPPED=0
trap - ERR

printf '\nImportazione completata con successo.\n'
printf 'Dump:                   %s\n' "${OUTPUT_FILE}"
printf 'Tabelle importate:      %s\n' "${table_count}"
if [[ -n "${LOCAL_BACKUP_DIR}" ]]; then
  printf 'Backup database locale: %s\n' "${LOCAL_BACKUP_DIR}"
fi
printf '\nÈ avviato soltanto MySQL. Per avviare il resto dello stack usa:\n'
printf '  docker compose up -d\n'
