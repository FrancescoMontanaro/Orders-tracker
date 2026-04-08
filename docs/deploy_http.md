# Deploy su VPS — HTTP (senza dominio)

## 1. Prerequisiti

Installazione di Docker e docker-compose:
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
sudo ufw allow 80/tcp
sudo ufw enable
```

---

## 2. Configura `.env`

Copia `.env.example` in `.env` e compila tutte le variabili. I valori di esempio qui sotto sono solo placeholder.

```dotenv
COMPOSE_PROFILES=dev

NEXT_PUBLIC_COMPANY_NAME=La Tua Azienda

DOMAIN=
LETSENCRYPT_EMAIL=

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

REFRESH_COOKIE_SECURE=false
```

---

## 3. Inizializza il repository Restic (solo la prima volta)

Crea la struttura del repository nel bucket S3 prima di avviare i servizi. Va fatto una sola volta; su installazioni successive (es. migrazione) questo step si salta.

```bash
docker compose run --rm db_backup restic init
```

---

## 4. Build e avvio

Compila le immagini e avvia tutti i container.

```bash
docker compose build --no-cache
docker compose up -d
```

Verifica:
- Frontend → `http://<IP_VPS>/`
- Backend health → `http://<IP_VPS>/api/health`

> Se vedi 503, il backup gate sta bloccando l'accesso perché nessun backup è ancora stato eseguito. Forza il primo backup manualmente:
> ```bash
> docker compose exec db_backup /usr/local/bin/backup.sh
> ```

---

## 5. Aggiornamenti

Aggiorna il codice e ricostruisce le immagini modificate.

```bash
git pull
docker compose build --no-cache
docker compose up -d
```
