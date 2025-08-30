# Backup automatico del database MySQL con Docker Compose + Restic

Questa guida mostra come effettuare **backup automatici** di un database MySQL usando un servizio dedicato (`db_backup`) che sfrutta **Restic** per snapshot incrementali e retention policy.

---

## Avvio e test

Avvia lo stack (incluso il servizio di backup):

```bash
docker compose up -d
```

Esegui subito un backup manuale di test:

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
```

Verifica i log:

```bash
docker compose logs -f db_backup
```

Controlla le snapshot disponibili nel repository Restic:

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

### 2. Elenca i file nell’ultimo snapshot

```bash
docker compose run --rm db_backup restic ls latest "/mysql/"
```

Troverai voci del tipo:

```
mysql/<db_name>_YYYY-MM-DD_HH-MM-SS.sql.gz
```

Imposta il percorso del dump in una variabile:

```bash
dump="mysql/<db_name>_YYYY-MM-DD_HH-MM-SS.sql.gz"
```

### 3. Ripristina il file desiderato in una cartella locale

```bash
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  restic restore latest --include "${dump}" --target /restore
```

Il file sarà disponibile in:

```
./restore_out/${dump}
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

(già eseguita nello script `backup.sh`, ma può essere forzata manualmente)

```bash
docker compose run --rm db_backup restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6
```

---

# Salvataggio su storage bucket (S3 o compatibili)

## Aggiorna `docker-compose.yml`

Il servizio `db_backup` deve avere:

```yaml
services:
  db_backup:
    environment:
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY}   # es. s3:https://<endpoint>/<bucket>
      RESTIC_PASSWORD: ${RESTIC_PASSWORD}
      RESTIC_CACHE_DIR: /restic-cache

      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${AWS_REGION}
    volumes:
      - ./restic/restic_cache:/restic-cache
```

## 1) Inizializza il repository remoto (una volta sola)

```bash
docker compose run --rm db_backup restic init
```

Verifica:

```bash
docker compose run --rm db_backup restic snapshots
```

## 2) Esegui un backup di prova

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
```

Controlla le snapshot nel bucket remoto:

```bash
docker compose run --rm db_backup restic snapshots
```

## 3) Restore da bucket

Elenca i file:

```bash
docker compose run --rm db_backup restic ls latest /mysql/
```

Ripristina un dump:

```bash
docker compose run --rm -v "$PWD/restore_out:/restore" db_backup \
  sh -lc 'restic restore latest --include "/mysql/<db_name>_YYYY-MM-DD_HH-MM-SS.sql.gz" --target /restore'
```

Importa nel DB:

```bash
gunzip -c restore_out/mysql/<db_name>_YYYY-MM-DD_HH-MM-SS.sql.gz | \
  docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

### Stream diretto (senza file temporanei)

```bash
docker compose run --rm db_backup \
  sh -lc 'restic dump latest "/mysql/<db_name>_YYYY-MM-DD_HH-MM-SS.sql.gz"' \
  | gunzip \
  | docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
```

---

## Note operative

* Restic cifra **client‑side** con `RESTIC_PASSWORD`.
* La retention (`forget --prune`) è già inclusa nello script, ma può essere lanciata manualmente.
* Mantieni `RESTIC_CACHE_DIR` montato per prestazioni migliori.
* Se usi credenziali temporanee (STS/assume‑role), esporta anche `AWS_SESSION_TOKEN`.
* Il VPS deve poter uscire verso l’endpoint S3 (controlla firewall/egress).
