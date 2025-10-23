# Backup MySQL automatici con Docker Compose + Restic

*(guida compatta, aggiornata a `backup.sh` con filename fisso, cron e retention corretta)*

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

      # MySQL (se non già definiti)
      MYSQL_HOST: db
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
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

* Dump MySQL → gzip → Restic backup (`/mysql/<db>.sql.gz`)
* Tag: `mysql`, `orders-tracker`, `<db>`
* Retention automatica: `forget --prune` con `--keep-daily 7 --keep-weekly 4 --keep-monthly 6`
* Scrive heartbeat in `/status/last_ok`

> Filename fisso → pruning efficace e restore semplice.

---

## Scheduler (cron)

Nel container `db_backup` è configurato un cron:

```bash
SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Every day at 3AM and 3PM
0 3,15 * * * /usr/local/bin/backup.sh
```

L’immagine Docker:

```dockerfile
FROM alpine:3.20
RUN apk add --no-cache mysql-client tzdata ca-certificates restic
ENV TZ=Europe/Rome
COPY backup.sh /usr/local/bin/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup.sh
CMD ["crond", "-f", "-l", "2"]
```

> I log di cron vanno su **stdout**, quindi visibili con:
>
> ```bash
> docker compose logs -f db_backup
> ```

---

## Avvio e test

```bash
# Avvio dei servizi
docker compose up -d

# Esecuzione manuale del backup
docker compose exec db_backup /usr/local/bin/backup.sh

# Monitoraggio log cron
docker compose logs -f db_backup
```

Statistiche e integrità:

```bash
# Statistiche repository e spazio usato
docker compose exec db_backup restic stats

# Check integrità repository
docker compose run --rm db_backup restic check
```

Elenco snapshot:

```bash
# Elenco completo degli snapshot
docker compose run --rm db_backup restic snapshots \
  --host orders-db-backup --tag mysql --tag orders-tracker --tag orders
```

---

## Pulizia manuale

Dry-run:

```bash
# Dry-run della pulizia (senza eliminare nulla effettivamente)
docker compose run --rm db_backup \
  restic forget --dry-run --prune --group-by host,tags \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6
```

Pulizia effettiva:

```bash
# Esecuzione della pulizia effettiva
docker compose run --rm db_backup \
  restic forget --prune --group-by host,tags \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6
```

Eliminazione totale:

```bash
# Elimina tutti gli snapshot (attenzione!)
docker compose run --rm db_backup restic forget --prune --keep-last 0
```

---

## Restore (tre modalità)

### A) Ultimo snapshot (`latest`)

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

### C) Point-in-time (`--time`)

```bash
# Ripristina su ./restore_out a una data specifica
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  restic restore --time "2025-10-20 15:00:00" \
  --include "/mysql/orders_tracker.sql.gz" --target /restore
```

---

## Operatività utile

Ultimo heartbeat:

```bash
# Leggi ultimo heartbeat e converti in data leggibile
docker compose exec db_backup cat /status/last_ok | xargs -I{} date -r {}
```

Backup manuale:

```bash
# Esegui manualmente un backup
docker compose exec db_backup /usr/local/bin/backup.sh
```

Lista file in uno snapshot:

```bash
# Elenca file nello snapshot "latest"
docker compose run --rm db_backup restic ls latest "/mysql/"
```

---

## Note tecniche

* `gzip` riduce dimensione a scapito della deduplica → ok per dump SQL.
* `--group-by host,tags` evita grouping per path → pruning coerente.
* `RESTIC_REPOSITORY` e `RESTIC_PASSWORD` devono essere sempre definiti.
* Ripristino diretto su altro database modificando il nome nel comando `mysql`.