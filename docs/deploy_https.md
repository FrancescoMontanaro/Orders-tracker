# Deploy su VPS — HTTPS (con dominio e Let's Encrypt)

## 1. Prerequisiti

Il dominio deve già essere puntato all'IP del VPS prima di avviare i servizi, altrimenti il challenge ACME fallisce.

- Dominio con record A/AAAA puntato all'IP del VPS
- Porte 80 e 443 aperte

Download e installazione di Docker e docker-compose:
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login dopo
sudo apt install -y docker-compose-plugin
```

Configurazione firewall:
```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 2. Configura `.env`

Copia `.env.example` in `.env` e compila tutte le variabili. I valori di esempio qui sotto sono solo placeholder.

```dotenv
COMPOSE_PROFILES=prod

DOMAIN=esempio.tld
LETSENCRYPT_EMAIL=admin@esempio.tld

NEXT_PUBLIC_COMPANY_NAME=La Tua Azienda

MYSQL_DATABASE=orders
MYSQL_PORT=3306
MYSQL_USER=orders_user
MYSQL_PASSWORD=strongpass
MYSQL_ROOT_PASSWORD=strongroot

RESTIC_PASSWORD=supersecret
RESTIC_REPOSITORY=s3:s3.amazonaws.com/il-tuo-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-1

SECRET_KEY=super-secret-key
REGISTRATION_PASSWORD_HASH=...
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXP_MINUTES=15
REFRESH_TOKEN_EXP_DAYS=7

REFRESH_COOKIE_SECURE=true
```

---

## 3. Inizializza il repository Restic (solo la prima volta)

Crea la struttura del repository nel bucket S3 prima di avviare i servizi. Va fatto una sola volta; su installazioni successive (es. migrazione) questo step si salta.

```bash
docker compose run --rm db_backup restic init
```

---

## 4. Build e primo avvio

Compila le immagini e avvia tutti i container. Nginx parte in modalità HTTP-only finché Certbot non ottiene il certificato; dopodiché si ricarica automaticamente in HTTPS.

```bash
docker compose build --no-cache
docker compose --profile prod up -d
```

Verifica che il certificato sia stato emesso controllando i log di Certbot:

```bash
docker compose logs certbot_renew --tail 50
```

---

## 5. Verifica

- Frontend → `https://<DOMAIN>/`
- Backend health → `https://<DOMAIN>/api/health`

> Se vedi 503, il backup gate sta bloccando l'accesso perché nessun backup è ancora stato eseguito. Forza il primo backup manualmente:
> ```bash
> docker compose exec db_backup /usr/local/bin/backup.sh
> ```

---

## 6. Rinnovo certificati

Il rinnovo è gestito automaticamente da `certbot_renew` ogni 12h. Per verificare che funzioni senza emettere un certificato reale:

```bash
docker compose run --rm certbot_renew certbot renew --dry-run
```

---

## 7. Aggiornamenti

Aggiorna il codice e ricostruisce le immagini modificate.

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## 8. Troubleshooting

| Problema | Soluzione |
|----------|-----------|
| Challenge ACME 404 | Verifica che la porta 80 sia aperta e che il volume `./certbot/www` sia montato correttamente |
| Cert non visti da Nginx | Entrambi i servizi devono montare lo stesso volume `letsencrypt` |
| Rate limit Let's Encrypt | Aggiungi `--staging` a `certonly`/`renew` per i test, poi rimuovilo |
| 502/504 | Verifica che `frontend:3000`, `backend:8000`, `sentinel:8080` siano nella stessa rete `app-net` |
| Cookie non inviati | Controlla `REFRESH_COOKIE_SECURE=true` e che `CORS_ORIGINS` contenga `https://<DOMAIN>` |
