# Backup automatico in locale del database MySQL con Docker Compose + Restic

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
gunzip -c "restore_out/${dump}" | \
docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
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

---

# Salvataggio su storage bucket (S3 / S3‑compatibile)

## Aggiorna `docker-compose.yml`

### Opzione A — **AWS S3**

Aggiungi (o modifica) le env del servizio `db_backup`:

```yaml
services:
  db_backup:
    environment:
      # Restic
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY} # Es.: s3:https://s3.eu-central-1.amazonaws.com/orders-tracker-db-backups-test
      RESTIC_PASSWORD: ${RESTIC_PASSWORD}
      RESTIC_CACHE_DIR: /restic-cache

      # Credenziali S3
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${AWS_REGION} # Es.: eu-central-1

    volumes:
      - ./restic_cache:/restic-cache
```

## 2) Inizializza il repository remoto (una volta sola)

> Se hai già inizializzato un repo locale, questo è **un altro** repository: va inizializzato a parte.

```bash
docker compose run --rm db_backup restic init
```

Verifica che sia raggiungibile e vuoto:

```bash
docker compose run --rm db_backup restic snapshots
```

---

## 3) Esegui un backup di prova

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
```

Controlla che la snapshot sia nel bucket remoto:

```bash
docker compose run --rm db_backup restic snapshots
```

---

## 4) Restore da bucket

Il flusso non cambia, solo che le snapshot vengono lette dal repository remoto.

**Elenca i file nell’ultima snapshot:**

```bash
docker compose run --rm db_backup restic ls latest /mysql/
```

**Ripristina un dump in una cartella locale e poi importalo nel DB:**

```bash
# restore del file dallo snapshot remoto
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  sh -lc 'restic restore latest --include "/mysql/orders_tracker_YYYY-MM-DD_HH-MM-SS.sql.gz" --target /restore'

# import nel DB (dentro il container MySQL)
gunzip -c restore_out/mysql/orders_tracker_YYYY-MM-DD_HH-MM-SS.sql.gz | \
  docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

In alternativa puoi fare lo **stream diretto** senza file temporanei usando:
```bash
docker compose run --rm db_backup \
  sh -lc 'restic dump latest "/mysql/orders_tracker_YYYY-MM-DD_HH-MM-SS.sql.gz"' \
  | gunzip \
  | docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

---

## 5) Note operative

* Restic cifra **client‑side**: i dati sul bucket sono sempre criptati con `RESTIC_PASSWORD`.
* La **retention** resta gestita dallo script (`restic forget --prune`). Puoi adattare i keep *daily/weekly/monthly*.
* Mantieni `RESTIC_CACHE_DIR` montato per performance migliori e meno banda.
* Se usi credenziali temporanee (STS/assume‑role), esporta anche `AWS_SESSION_TOKEN` nel servizio `db_backup`.
* Assicurati che il tuo VPS possa uscire su Internet verso l’endpoint del bucket (firewall/egress).

---