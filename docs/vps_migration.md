# Migrazione su nuovo VPS

> **Principio fondamentale:** i due VPS non devono mai scrivere sul bucket contemporaneamente con lo stesso host tag. Il rischio è che `restic forget --prune` sul nuovo VPS (con DB vuoto) poti snapshot validi del vecchio VPS.

---

## 1. Sul vecchio VPS — esegui un backup finale

Assicurati di avere uno snapshot aggiornato prima di toccare qualsiasi cosa.

```bash
docker compose run --rm db_backup /usr/local/bin/backup.sh
```

Verifica che lo snapshot sia presente:

```bash
docker compose run --rm db_backup restic snapshots --last
```

---

## 2. Sul vecchio VPS — ferma il servizio di backup

Impedisce che il vecchio VPS continui a scrivere sul bucket mentre il nuovo è in fase di setup.

```bash
docker compose stop db_backup
```

> Il DB rimane attivo: il vecchio VPS è ancora online come fallback finché la migrazione non è verificata.

---

## 3. Sul nuovo VPS — clona il progetto e configura `.env`

Prepara l'ambiente con le stesse credenziali del vecchio VPS in modo da poter accedere agli snapshot esistenti nel bucket.

```bash
git clone <repo-url>
cd orders-tracker
cp .env.example .env
```

Compila `.env` con le **stesse credenziali** del vecchio VPS (stesso bucket S3, stesso `RESTIC_PASSWORD`, stesso `RESTIC_REPOSITORY`).

Aggiungi questa variabile per isolare il gruppo di retention durante la migrazione: se il cron parte prima del previsto, i suoi snapshot non interferiscono con quelli validi del vecchio VPS.

```dotenv
RESTIC_HOST_TAG=orders-db-backup-migration
```

---

## 4. Sul nuovo VPS — avvia solo il database

Avvia MySQL prima di fare il restore, così il DB è pronto a ricevere i dati. Gli altri servizi restano fermi per evitare che il backup gate (sentinel) parta con un DB ancora vuoto.

```bash
docker compose up -d db
```

Attendi che MySQL sia pronto:

```bash
docker compose logs db --tail 20
```

---

## 5. Sul nuovo VPS — ripristina il database dal backup

Scarica l'ultimo snapshot dal bucket S3 e lo importa direttamente nel DB.

```bash
docker compose run --rm db_backup \
  sh -lc 'restic dump latest "/mysql/orders_tracker.sql.gz"' \
| gunzip \
| docker compose exec -T db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h127.0.0.1 -u"$MYSQL_USER" "$MYSQL_DATABASE"'
```

Verifica che i dati siano presenti prima di procedere:

```bash
docker compose exec db sh -lc \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u"$MYSQL_USER" "$MYSQL_DATABASE" -e "SHOW TABLES;"'
```

---

## 6. Sul nuovo VPS — avvia tutti i servizi

Ripristina il tag definitivo nel `.env` in modo che la retention policy sul nuovo VPS gestisca gli snapshot nello stesso gruppo del vecchio:

```dotenv
RESTIC_HOST_TAG=orders-db-backup
```

Avvia l'intera stack:

```bash
# Deploy HTTP
docker compose up -d

# oppure Deploy HTTPS
docker compose --profile prod up -d
```

---

## 7. Verifica finale

Controlla che l'app funzioni e che il primo backup del nuovo VPS vada a buon fine.

- Frontend raggiungibile e dati corretti
- Backup manuale eseguito con successo:

```bash
docker compose exec db_backup /usr/local/bin/backup.sh
docker compose run --rm db_backup restic snapshots --last
```

---

## 8. Spegni il vecchio VPS

Solo dopo aver verificato che tutto funziona, spegni o distruggi il vecchio VPS.

---

## 9. Rimuovi gli snapshot temporanei di migrazione

Gli snapshot creati durante la migrazione con `RESTIC_HOST_TAG=orders-db-backup-migration` non rientrano nella retention policy normale e vanno rimossi manualmente.

Verifica prima cosa c'è nel gruppo:

```bash
docker compose run --rm db_backup restic snapshots --host orders-db-backup-migration
```

Poi elimina tutti gli snapshot di quel gruppo:

```bash
docker compose run --rm db_backup restic forget --prune \
  --host orders-db-backup-migration \
  --keep-within 0s
```

> Se la versione di Restic non accetta `--keep-within 0s`, elenca gli ID con il comando precedente e passali esplicitamente:
> ```bash
> docker compose run --rm db_backup restic forget --prune <ID1> <ID2> ...
> ```

---

## Riepilogo delle fasi critiche

| Fase | Vecchio VPS | Nuovo VPS |
|------|-------------|-----------|
| Backup finale | `db_backup` attivo | — |
| Stop backup | `db_backup` fermo | — |
| Restore | — | solo `db` attivo, `RESTIC_HOST_TAG` temporaneo |
| Go-live | spento | tutti i servizi attivi, tag definitivo |
