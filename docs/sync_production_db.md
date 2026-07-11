# Sincronizzazione del database di produzione in locale

Lo script `scripts/sync_production_db.sh` crea un dump logico MySQL sul server di
produzione tramite SSH, lo comprime localmente e sostituisce il database di
sviluppo. Il dump logico evita le incompatibilità di `lower_case_table_names`
tra il filesystem Linux di produzione e quello case-insensitive di macOS.

## Prerequisiti

- accesso SSH al server di produzione;
- Docker Compose disponibile sia in locale sia sul server;
- servizio MySQL denominato `db` in entrambi i file Compose;
- variabili `MYSQL_DATABASE` e `MYSQL_ROOT_PASSWORD` presenti nei container;
- autenticazione SSH già configurata, preferibilmente tramite chiave.

## Esecuzione

Da root del repository:

```bash
./scripts/sync_production_db.sh \
  --ssh deploy@example.com \
  --remote-dir /opt/orders-tracker
```

Se il progetto si trova nella home dell'utente remoto, il carattere `~` deve
essere racchiuso tra apici per impedirne l'espansione da parte della shell
locale:

```bash
./scripts/sync_production_db.sh \
  --ssh root@example.com \
  --remote-dir '~/Orders-tracker'
```

Per l'utente `root`, il percorso assoluto equivalente è normalmente
`/root/Orders-tracker`.

Con una porta SSH personalizzata:

```bash
./scripts/sync_production_db.sh \
  --ssh deploy@example.com \
  --ssh-port 2222 \
  --remote-dir /opt/orders-tracker
```

Lo script richiede di scrivere `IMPORTA` prima di modificare il database locale.
Per un'esecuzione non interattiva è disponibile `--yes`.

## Risultato

- il dump viene salvato in `database_dumps/`;
- il vecchio datadir viene conservato come `database.before-sync-<timestamp>/`;
- un database locale pulito viene inizializzato e popolato con il dump;
- al termine rimane avviato soltanto il servizio `db`.

Dopo aver verificato l'importazione, avviare gli altri servizi con:

```bash
docker compose up -d
```

Non eliminare `database.before-sync-<timestamp>/` finché i dati importati non
sono stati controllati. Se avvio o importazione falliscono, lo script prova a
ripristinare automaticamente il precedente datadir locale.
