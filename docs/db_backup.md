# Backup MySQL automatici con Docker Compose + Restic

## Architettura del Sistema di Backup

```
+---------------------------------------------------------------------+
|                         ORDERS TRACKER                               |
+---------------------------------------------------------------------+
|                                                                      |
|  +----------+    +-------------+    +--------------+                |
|  |  MySQL   |--->|  db_backup  |--->|  S3 Bucket   |                |
|  |   (db)   |    |  (restic)   |    |  (off-site)  |                |
|  +----------+    +------+------+    +--------------+                |
|                         |                                            |
|                         v heartbeat                                  |
|                    +---------+                                       |
|                    | /status | (bind mount)                          |
|                    +----+----+                                       |
|                         |                                            |
|                         v check                                      |
|  +----------+    +--------------+    +---------+                    |
|  |  nginx   |<-->|   sentinel   |<---|backend  |                    |
|  +----------+    +--------------+    |frontend |                    |
|                         |            +---------+                     |
|                         v                                            |
|                  503 if backup stale                                 |
|                                                                      |
+---------------------------------------------------------------------+
```

## Funzionalita di Sicurezza

| Feature | Descrizione |
|---------|-------------|
| **Backup off-site** | I dati sono su S3, separati dal VPS |
| **Backup schedulato** | 2 backup/giorno (3:00 e 15:00) |
| **Retention automatica** | 7 daily + 4 weekly + 6 monthly |
| **Prune automatico** | Pulizia effettiva dei vecchi snapshot |
| **Integrity check** | Verifica automatica ogni 6 backup (~3 giorni) |
| **Verifica settimanale** | Test restore completo ogni domenica |
| **Sentinel** | App bloccata se backup non funziona |
| **Pre-flight checks** | Verifica connessioni prima del backup |

## Prerequisiti

Nel servizio `db_backup` di `docker-compose.yml`:

```yaml
services:
  db_backup:
    environment:
      # Restic
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY}   # es: s3:https://endpoint/bucket
      RESTIC_PASSWORD: ${RESTIC_PASSWORD}
      RESTIC_CACHE_DIR: /restic-cache
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${AWS_REGION}

      # MySQL
      MYSQL_HOST: db
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      
      # Optional: integrity check frequency (default: every 6 backups)
      BACKUP_CHECK_INTERVAL: "6"
    volumes:
      - ./restic/restic_cache:/restic-cache
      - ./status:/status
```

Inizializza una sola volta il repository Restic:

```bash
docker compose run --rm db_backup restic init
```

---

## Script di backup

`backup.sh` esegue:

1. **Pre-flight checks**: verifica connessione MySQL e accesso al repository
2. **Dump MySQL** -> gzip -> Restic backup (`/mysql/<db>.sql.gz`)
3. **Retention policy**: `forget --prune` con `--keep-daily 7 --keep-weekly 4 --keep-monthly 6`
4. **Integrity check periodico**: `restic check --read-data-subset=5%` ogni N backup
5. **Heartbeat update**: scrive timestamp in `/status/last_ok`

> Il backup NON aggiorna l'heartbeat se fallisce, causando il blocco dell'app.

---

## Scheduler (cron)

```bash
# Backup: Every day at 3AM and 3PM
0 3,15 * * * /usr/local/bin/backup.sh

# Full verification: Every Sunday at 5AM
0 5 * * 0 /usr/local/bin/verify.sh
```

---

## Verifica manuale

### Esegui backup manuale

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
```

### Esegui verifica completa

```bash
docker compose exec db_backup /usr/local/bin/verify.sh
```

### Statistiche e integrità

```bash
# Statistiche repository
docker compose exec db_backup restic stats

# Check integrita completa
docker compose run --rm db_backup restic check

# Check integrita con verifica dati (piu lento)
docker compose run --rm db_backup restic check --read-data
```

### Elenco snapshot

```bash
docker compose run --rm db_backup restic snapshots
```

---

## Restore

### A) Ultimo snapshot (latest)

```bash
# Elenca file nello snapshot
docker compose run --rm db_backup restic ls latest "/mysql/"

# Ripristina su ./restore_out
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  restic restore latest --include "/mysql/orders_tracker.sql.gz" --target /restore

# Import nel DB
gunzip -c restore_out/mysql/orders_tracker.sql.gz | \
docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

### B) Snapshot specifico (per ID)

```bash
# Elenca snapshot per ottenere l'ID
docker compose run --rm db_backup restic snapshots

# Ripristina direttamente nel DB
docker compose run --rm db_backup \
  sh -lc 'restic dump <SNAPSHOT_ID> "/mysql/orders_tracker.sql.gz"' \
| gunzip \
| docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

### C) Point-in-time (--time)

```bash
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  restic restore --time "2025-10-20 15:00:00" \
  --include "/mysql/orders_tracker.sql.gz" --target /restore
```

---

## Sentinel: Come Funziona

Il servizio `sentinel` espone l'endpoint `/ok` che:

- Ritorna **200 OK** se l'heartbeat esiste ed e recente (< 26h)
- Ritorna **503 Service Unavailable** se l'heartbeat e assente o troppo vecchio

Nginx usa `auth_request` per consultare il sentinel prima di ogni richiesta:
- Se 200 -> la richiesta passa
- Se 503 -> l'utente vede "Service unavailable: backup status not OK"

### Parametri configurabili

| ENV | Default | Descrizione |
|-----|---------|-------------|
| `SENTINEL_THRESHOLD_SECONDS` | 93600 (26h) | Max eta heartbeat |
| `SENTINEL_BOOT_GRACE_SECONDS` | 86400 (24h) | Tolleranza al primo avvio |
| `SENTINEL_HEARTBEAT_PATH` | `/status/last_ok` | Path del file heartbeat |

---

## Troubleshooting

### L'app mostra "backup status not OK"

1. Controlla lo stato del backup:
   ```bash
   docker compose logs db_backup --tail 100
   ```

2. Verifica l'heartbeat:
   ```bash
   docker compose exec db_backup cat /status/last_ok
   ```

3. Esegui un backup manuale:
   ```bash
   docker compose exec db_backup /usr/local/bin/backup.sh
   ```

### Il repository sembra corrotto

```bash
# Check completo
docker compose run --rm db_backup restic check --read-data

# Se necessario, ripara
docker compose run --rm db_backup restic repair index
docker compose run --rm db_backup restic repair snapshots
```

### Spazio S3 in crescita

Verifica che prune funzioni:
```bash
docker compose run --rm db_backup restic stats
docker compose run --rm db_backup restic prune
```

---

## Disaster Recovery Checklist

In caso di perdita totale del VPS:

1. **Provisiona nuovo VPS**
2. **Clona il repository** (o ripristina da backup del codice)
3. **Configura `.env`** con le stesse credenziali S3/Restic
4. **Avvia i servizi base**:
   ```bash
   docker compose up -d db
   ```
5. **Ripristina il database**:
   ```bash
   docker compose run --rm db_backup \
     sh -lc 'restic dump latest "/mysql/orders_tracker.sql.gz"' \
   | gunzip \
   | docker compose exec -T db sh -lc \
     'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER"'
   ```
6. **Avvia tutti i servizi**:
   ```bash
   docker compose --profile prod up -d
   ```

---

## Note tecniche

- `gzip` riduce dimensione a scapito della deduplica -> ok per dump SQL
- `--group-by host,tags` evita grouping per path -> pruning coerente
- `RESTIC_REPOSITORY` e `RESTIC_PASSWORD` devono essere sempre definiti
- Il volume `status` e un **bind mount** per persistere tra `docker compose down -v`
- Lo script usa `set -eu` per fallire immediatamente in caso di errori
