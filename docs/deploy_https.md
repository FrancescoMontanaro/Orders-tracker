# Deploy su VPS con dominio e HTTPS (Next.js + FastAPI + MySQL + Nginx)

> **Obiettivo**: pubblicare l’applicazione su un VPS usando Docker Compose, con reverse proxy Nginx e certificati TLS Let’s Encrypt. Configurazione adattata al `docker-compose.yml` fornito, mantenendo i bind mount e gli healthcheck esistenti.

---

## 1) Prerequisiti

* VPS con Docker e Docker Compose installati.
* Dominio registrato, con record **A** (e **AAAA** opzionale) puntato all’IP del VPS.
* Porte 80 e 443 aperte nel firewall del VPS.

Esempio (Ubuntu):

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login della sessione per applicare il gruppo

sudo apt install -y docker-compose-plugin ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 2) Struttura cartelle consigliata

```
.
├── backend/
│   ├── app/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.production
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── .env.production
├── nginx/
│   └── default.conf
├── docker-compose.yml
└── database/              # bind mount MySQL (già previsto nel compose)
```

> `database/` contiene i dati persistenti di MySQL (bind mount: `./database:/var/lib/mysql`).

---

## 3) Variabili d’ambiente

### 3.1 Backend (`backend/.env.production`)

```env
# DB
DB_USER="<<nome-utente-db>>"
DB_PASSWORD="<<password-db>>"
DB_HOST="db"
DB_PORT="3306"
DB_NAME="orders_tracker"

# Security
SECRET_KEY=<<valore-esadecimale-casuale-lungo>>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXP_MINUTES=1440
REFRESH_TOKEN_EXP_DAYS=7

# CORS consentiti (dominio pubblico)
BACKEND_CORS_ORIGINS=["https://app.esempio.com", "http://localhost"]

# Registrazione protetta (hash SHA-256 della registration password)
REGISTRATION_PASSWORD_HASH=<<sha256-hex>>
```

> La rotta di healthcheck del backend è `/health` (già prevista nell’healthcheck del compose).

### 3.2 Frontend (`frontend/.env.production`)

```env
NEXT_PUBLIC_COMPANY_NAME="<<nome-company>>"
NEXT_PUBLIC_API_BASE_URL=/api
```

> Next.js legge automaticamente `.env.production` in fase di build.

### 3.3 Database (`database/.env.production`)

```env
DB_USER="<<nome-utente-db>>"
DB_PASSWORD="<<password-db>>"
DB_HOST="db"
DB_PORT="3306"
DB_NAME="orders_tracker"
```

---

## 4) Nginx reverse proxy + HTTPS

### 4.1 `nginx/default.conf`

Sostituire **`app.esempio.com`** con il dominio reale.

```nginx
# HTTP: challenge ACME + redirect a HTTPS
server {
  listen 80;
  server_name app.esempio.com;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;  # montato nel servizio nginx
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

# HTTPS con reverse proxy a frontend e backend
server {
  listen 443 ssl http2;
  server_name app.esempio.com;

  # Certificati (verranno creati da certbot)
  ssl_certificate /etc/letsencrypt/live/app.esempio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/app.esempio.com/privkey.pem;

  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  # Proxy al frontend Next.js
  location / {
    proxy_pass http://orders_tracker_frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Proxy al backend FastAPI su /api (riscrive il prefisso)
  location /api/ {
    rewrite ^/api/?(.*)$ /$1 break;
    proxy_pass http://orders_tracker_backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  client_max_body_size 20m;
}
```

---

## 5) `docker-compose.yml` (adattato)

Versione aggiornata che mantiene i servizi esistenti, aggiunge l’esposizione della porta 443, e predispone i volumi per i certificati Let’s Encrypt tramite webroot.

```yaml
services:
  db:
    image: mysql:8.0
    container_name: orders_tracker_db
    command: --default-authentication-plugin=mysql_native_password --innodb_flush_log_at_trx_commit=1 --innodb_flush_method=O_DIRECT
    environment:
      MYSQL_DATABASE: ${MYSQL_DATABASE:-orders}
      MYSQL_USER: ${MYSQL_USER:-orders}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-orders}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
    volumes:
      - ./database:/var/lib/mysql
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h localhost -u$$MYSQL_USER -p$$MYSQL_PASSWORD --silent"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks: [app-net]
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: orders_tracker_backend
    env_file:
      - ./backend/.env.production
    depends_on:
      db:
        condition: service_healthy
    expose:
      - "8000"
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8000/health || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 12
    networks: [app-net]
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: orders_tracker_frontend
    env_file:
      - ./frontend/.env.production
    depends_on:
      backend:
        condition: service_healthy
    expose:
      - "3000"
    networks: [app-net]
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: orders_tracker_nginx
    depends_on:
      - frontend
      - backend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    networks: [app-net]
    restart: unless-stopped

  certbot:
    image: certbot/certbot
    container_name: orders_tracker_certbot
    depends_on:
      - nginx
    volumes:
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    entrypoint: sh
    command: -c "trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot; sleep 12h & wait $${!}; done"

networks:
  app-net:
    driver: bridge
```

> Il servizio `certbot` effettua un tentativo di rinnovo ogni 12 ore. La prima emissione del certificato va eseguita manualmente (vedi sezione successiva).

---

## 6) Build delle immagini

Eseguire la build da zero (in particolare il frontend necessita delle variabili in build):

```bash
docker compose build --no-cache
```

> Il file `frontend/.env.production` deve essere presente nel contesto di build e **non** ignorato dal `.dockerignore`.

---

## 7) Emissione iniziale dei certificati

1. Avviare **solo Nginx** (necessario per la challenge HTTP su porta 80):

```bash
docker compose up -d nginx
```

2. Eseguire Certbot in modalità **webroot** per emettere i certificati per il dominio (sostituire `app.esempio.com` e l’email):

```bash
docker compose run --rm certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d app.esempio.com \
  --email admin@app.esempio.com \
  --agree-tos --no-eff-email
```

3. Riavviare Nginx (ora i certificati sono disponibili):

```bash
docker compose restart nginx
```

---

## 8) Avvio dell’intero stack (HTTPS attivo)

```bash
docker compose up -d
```

Verifiche:

* Frontend: `https://app.esempio.com/`
* Backend (health): `https://app.esempio.com/api/health`

---

## 9) Rinnovo automatico e test

Il container `certbot` tenta il rinnovo periodico; per un test manuale senza emettere nuovi certificati:

```bash
docker compose run --rm certbot certbot renew --dry-run
```

In caso di rinnovo riuscito, Nginx può essere ricaricato:

```bash
docker compose exec -T nginx nginx -s reload
```

Suggerimento: inserire un cron di sistema che esegua il `renew` e poi `nginx -s reload` (alternativo al loop nel container).

---

## 10) Note operative

* I dati MySQL sono persistenti in `./database`. Un riavvio o ricreazione dei container non li elimina.
* Le variabili `MYSQL_*` vengono lette **solo al primo avvio** del volume MySQL. Se cambiano, ricreare l’utente/permessi nel DB o droppare il volume.
* Per il backend, assicurarsi che il dialetto in `DATABASE_URL` corrisponda al driver installato in `requirements.txt` (es. `aiomysql`).
* Per il frontend, tutte le variabili usate dal **client** devono essere definite in build (`NEXT_PUBLIC_*`) e presenti in `.env.production`.
* La rotta di healthcheck del backend è `/health` ed è già usata nel compose.

---

## 11) Aggiornamenti dell’applicazione

```bash
git pull
# facoltativo: aggiornare requirements / package.json

# rebuild (cache pulita consigliata se cambiano env di build del frontend)
docker compose build --no-cache

docker compose up -d
```

---

## 12) Troubleshooting essenziale

* **HTTP 404 su \*\*\*\*\*\*\*\*`/.well-known/acme-challenge/…`**: verificare i volumi `nginx/certbot/www` e la prima sezione server su porta 80.
* **Certificati non trovati**: assicurarsi che `nginx/certbot/conf` contenga `live/app.esempio.com/…` e che la `server_name` corrisponda.
* **CORS o cookie**: impostare `BACKEND_CORS_ORIGINS` con il dominio HTTPS e, se usati cookie, `Secure` e `SameSite` corretti.
* **Connessione DB rifiutata**: controllare `DATABASE_URL` (host `db`, non `127.0.0.1`) e che l’utente esista con privilegi sul DB.
