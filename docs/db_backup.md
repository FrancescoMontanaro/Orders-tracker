# Backup del database — Operazioni

## Inizializzazione (solo la prima volta)

Crea la struttura del repository nel bucket S3. Va eseguito una sola volta sul primo deploy; su reinstallazioni o migrazioni questo step si salta perché il repository esiste già.

```bash
docker compose run --rm db_backup restic init
```

---

## Backup manuale

Esegue immediatamente un backup, utile per forzare uno snapshot prima di operazioni critiche o per sbloccare il backup gate dopo il primo avvio.

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
```

---

## Verifica completa (test restore incluso)

Esegue un check di integrità del repository e testa il restore dell'ultimo snapshot. Utile per verificare che i backup siano effettivamente recuperabili.

```bash
docker compose exec db_backup /usr/local/bin/verify.sh
```

---

## Elenco snapshot

Mostra tutti gli snapshot presenti nel repository con ID, data e tag.

```bash
docker compose run --rm db_backup restic snapshots
```

---

## Restore

### A) Ultimo snapshot

Scarica e importa direttamente nel DB l'ultimo backup disponibile.

```bash
docker compose run --rm db_backup \
  sh -lc 'restic dump latest "/mysql/orders_tracker.sql.gz"' \
| gunzip \
| docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

### B) Snapshot specifico (per ID)

Utile quando si vuole tornare a un punto preciso nel passato. L'ID si ottiene dal comando `restic snapshots`.

```bash
docker compose run --rm db_backup \
  sh -lc 'restic dump <SNAPSHOT_ID> "/mysql/orders_tracker.sql.gz"' \
| gunzip \
| docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

### C) Point-in-time

Ripristina il backup più vicino a un dato momento. Il dump viene prima estratto in locale, poi importato.

```bash
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  restic restore --time "2025-10-20 15:00:00" \
  --include "/mysql/orders_tracker.sql.gz" --target /restore

gunzip -c restore_out/mysql/orders_tracker.sql.gz | \
docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

---

## Integrità repository

```bash
# Check veloce (solo metadati)
docker compose run --rm db_backup restic check

# Check completo con verifica dati (più lento)
docker compose run --rm db_backup restic check --read-data
```

---

## Troubleshooting

### App mostra "backup status not OK"

Il sentinel blocca l'app perché l'ultimo backup è troppo vecchio o fallito. Controlla i log, verifica l'heartbeat e forza un backup manuale.

```bash
docker compose logs db_backup --tail 100
docker compose exec db_backup sh -c 'date -d @$(cat /status/last_ok)'
docker compose exec db_backup /usr/local/bin/backup.sh
```

### Repository corrotto

```bash
docker compose run --rm db_backup restic check --read-data
docker compose run --rm db_backup restic repair index
docker compose run --rm db_backup restic repair snapshots
```

### Spazio S3 in crescita

Il prune automatico potrebbe non aver funzionato. Verifica le statistiche e forza la pulizia.

```bash
docker compose run --rm db_backup restic stats
docker compose run --rm db_backup restic prune
```
