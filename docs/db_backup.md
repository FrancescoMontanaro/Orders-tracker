# Backup automatico del database MySQL con Docker Compose + Restic

Questa guida mostra come effettuare **backup automatici giornalieri** di un database MySQL usando un servizio dedicato (`db_backup`) che sfrutta **Restic** per la gestione incrementale e la retention.

---

## Avvio e test

Avvia lo stack (incluso il servizio di backup):

```bash
docker compose up -d
```

Per testare subito il funzionamento del backup manualmente:

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
```

Verifica i log del servizio:

```bash
docker compose logs -f db_backup
```

Controlla le snapshot disponibili nel repository restic:

```bash
docker compose run --rm db_backup restic snapshots
```

---

## Ripristino (restore) di un backup

> ⚠️ Il ripristino sovrascrive i dati esistenti. Usa con cautela.

### 1. Metti in pausa l’applicazione

```bash
docker compose stop backend frontend nginx
```

### 2. Elenca i file disponibili dentro l’ultimo snapshot

```bash
docker compose run --rm db_backup restic ls latest "/mysql/"
```

Troverai voci tipo:

```
mysql/orders_2025-08-29_03-00-00.sql.gz
```

Imposta il percoso del dump come variabile:
```bach
dump="mysql/orders_2025-08-29_03-00-00.sql.gz"
```

### 3. Ripristina il file desiderato in una cartella locale

```bash
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  restic restore latest --include "${dump}" --target /restore
```

Il dump sarà disponibile in:

```
./restore_out/mysql/orders_2025-08-29_03-00-00.sql.gz
```

### 4. Carica il dump nel database MySQL

```bash
gunzip -c restore_out/${dump} | \
docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p "$MYSQL_DATABASE"'
```

### 5. Riavvia i servizi applicativi

```bash
docker compose up -d backend frontend nginx
```

---

## Gestione del repository Restic

### Lista snapshot

```bash
docker compose run --rm db_backup restic snapshots
```

### Verifica integrità

```bash
docker compose run --rm db_backup restic check
```

### Pulizia con retention policy

(già eseguita automaticamente nello script `backup.sh`, ma puoi forzare manualmente)

```bash
docker compose run --rm db_backup restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6
```