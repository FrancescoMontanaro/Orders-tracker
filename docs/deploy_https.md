# Deploy su VPS con **dominio** e **HTTPS** (Next.js + FastAPI + MySQL + Nginx)

> **Obiettivo**: pubblicare l’applicazione su un VPS usando Docker Compose con reverse proxy Nginx e certificati TLS Let’s Encrypt. Guida **senza hard‑coding**: tutto è parametrizzato dal file `.env` **unico** nella root del progetto e dai **profili** di Compose (`dev` / `prod`).

---

## 1) Prerequisiti

* VPS con Docker e Docker Compose installati
* Dominio con record **A** (e/o **AAAA**) puntato all’IP del VPS
* Porte **80** e **443** aperte sul VPS (firewall)

Esempio rapido (Ubuntu):

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login della sessione

sudo apt install -y docker-compose-plugin ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 2) Struttura cartelle

```
.
├── backend/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   └── Dockerfile
├── nginx/
│   ├── prod.conf.tpl    # template Nginx con ${DOMAIN}
│   └── dev.conf         # (opzionale) HTTP-only per profilo dev
├── docker-compose.yml
├── .env                 # unico file di configurazione (root)
└── database/            # dati MySQL persistenti (bind mount)
```

---

## 3) Root `.env` (unico)

> Imposta qui **tutte** le variabili. Per l’ambiente produzione imposta `COMPOSE_PROFILES=prod`.

```dotenv
# Application name (frontend)
NEXT_PUBLIC_COMPANY_NAME=

# Application domain (per HTTPS)
DOMAIN=
LETSENCRYPT_EMAIL=

# Compose profile (dev = HTTP, prod = HTTPS + Certbot)
COMPOSE_PROFILES=prod

# Database
MYSQL_DATABASE=
MYSQL_PORT=3306
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_ROOT_PASSWORD=

# Database backup (Restic)
RESTIC_PASSWORD=
RESTIC_REPOSITORY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=

# Backend security
SECRET_KEY=
REGISTRATION_PASSWORD_HASH=
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXP_MINUTES=15
REFRESH_TOKEN_EXP_DAYS=7

# Cookie/CORS
REFRESH_COOKIE_SECURE=true
```

> Nota: il backend riceverà `CORS_ORIGINS` dal Compose come JSON che include `https://${DOMAIN}`.

---

## 4) Nginx reverse proxy **HTTPS** (template)

Usa un **template** con `${DOMAIN}` e `envsubst` in avvio (gestito dal servizio `nginx_prod`). Include anche il **backup gate** (sentinel) per fail‑closed quando i backup non sono aggiornati.

**`nginx/prod.conf.tpl`**

```nginx
# HTTP: ACME challenge + redirect to HTTPS
server {
  listen 80;
  server_name ${DOMAIN};

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

# HTTPS reverse proxy with backup gate and TLS
server {
  listen 443 ssl http2;
  server_name ${DOMAIN};

  ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  # --- Backup gate: subrequest to the sentinel ---
  location = /__backup_gate__ {
    internal;
    proxy_pass http://sentinel:8080/ok;
    proxy_http_version 1.1;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Original-URI $request_uri;
    proxy_connect_timeout 1s;
    proxy_read_timeout 2s;
  }

  # Courtesy page when the gate denies access
  location = /__unavailable__ {
    return 503 "Service unavailable: backup status not OK.\n";
    add_header Retry-After 3600;
    default_type text/plain;
  }

  proxy_intercept_errors on;
  error_page 401 403 500 502 503 504 =503 /__unavailable__;

  # (Optional) Bypass the gate for backend health checks
  location = /api/health {
    rewrite ^/api/?(.*)$ /$1 break;
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Frontend (protected by the gate)
  location / {
    auth_request /__backup_gate__;
    proxy_pass http://frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  # Backend API under /api (protected by the gate, prefix rewritten)
  location /api/ {
    auth_request /__backup_gate__;
    rewrite ^/api/?(.*)$ /$1 break;
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  client_max_body_size 20m;
}
```

---

## 5) Docker Compose (profilo **prod**)

Il tuo `docker-compose.yml` usa profili. In produzione attiva `nginx_prod` e `certbot` con `COMPOSE_PROFILES=prod` nel `.env` root. Le variabili sono interpolate dal `.env` unico.

> I servizi `nginx_prod` e `certbot` montano i volumi per i certificati e renderizzano `prod.conf.tpl` con `${DOMAIN}`.

Snippet riepilogativo (coerente con la tua configurazione):

```yaml
services:
  backend:
    environment:
      DB_HOST: db
      DB_USER: ${MYSQL_USER}
      DB_PASSWORD: ${MYSQL_PASSWORD}
      DB_PORT: ${MYSQL_PORT:-3306}
      DB_NAME: ${MYSQL_DATABASE}
      SECRET_KEY: ${SECRET_KEY}
      REGISTRATION_PASSWORD_HASH: ${REGISTRATION_PASSWORD_HASH}
      JWT_ALGORITHM: ${JWT_ALGORITHM}
      ACCESS_TOKEN_EXP_MINUTES: ${ACCESS_TOKEN_EXP_MINUTES}
      REFRESH_TOKEN_EXP_DAYS: ${REFRESH_TOKEN_EXP_DAYS}
      CORS_ORIGINS: '["https://${DOMAIN}", "http://localhost:3000"]'
      REFRESH_COOKIE_SECURE: ${REFRESH_COOKIE_SECURE}
      REFRESH_COOKIE_DOMAIN: ${DOMAIN}

  frontend:
    build:
      args:
        NEXT_PUBLIC_COMPANY_NAME: ${NEXT_PUBLIC_COMPANY_NAME}
        NEXT_PUBLIC_API_BASE_URL: /api
        NEXT_PUBLIC_SITE_URL: https://${DOMAIN}

  nginx_prod:
    image: nginx:alpine
    profiles: ["prod"]
    environment:
      DOMAIN: ${DOMAIN}
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/prod.conf.tpl:/etc/nginx/templates/default.conf.tpl:ro
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    command: >
      /bin/sh -c "apk add --no-cache gettext >/dev/null &&
                  envsubst '$$DOMAIN' < /etc/nginx/templates/default.conf.tpl > /etc/nginx/conf.d/default.conf &&
                  nginx -g 'daemon off;'"

  certbot:
    image: certbot/certbot
    profiles: ["prod"]
    depends_on: [nginx_prod]
    environment:
      DOMAIN: ${DOMAIN}
      LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL}
    volumes:
      - ./nginx/certbot/conf:/etc/letsencrypt
      - ./nginx/certbot/www:/var/www/certbot
    entrypoint: sh
    command: -c "trap exit TERM; while :; do certbot renew --webroot -w /var/www/certbot; sleep 12h & wait $${!}; done"
```

> Assicurati che `nginx_prod`, `frontend`, `backend`, `sentinel` siano sulla stessa rete (`app-net`) e che `nginx_prod` abbia `depends_on` anche da `sentinel` (per il gate).

---

## 6) Build delle immagini

> Il frontend richiede le `NEXT_PUBLIC_*` **in build**.

```bash
docker compose build --no-cache
```

---

## 7) Emissione iniziale dei certificati (una sola volta)

1. Avvia **solo Nginx prod** (serve per la challenge HTTP su :80):

```bash
docker compose up -d nginx_prod
```

2. Emetti i certificati con Certbot in modalità **webroot** (usa `${DOMAIN}` dal `.env`):

```bash
docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "${DOMAIN}" \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos --no-eff-email
```

3. Ricarica Nginx (ora i certificati esistono):

```bash
docker compose restart nginx_prod
```

---

## 8) Avvio dell’intero stack (HTTPS attivo)

```bash
docker compose up -d
```

Verifiche:

* Frontend → `https://${DOMAIN}/`
* Backend health → `https://${DOMAIN}/api/health`

---

## 9) Rinnovo automatico e test

Il container `certbot` verifica il rinnovo ogni 12h. Testa senza generare nuove cert chain:

```bash
docker compose run --rm certbot certbot renew --dry-run
```

Dopo un rinnovo riuscito puoi ricaricare Nginx (opzionale):

```bash
docker compose exec -T nginx_prod nginx -s reload
```

---

## 10) Note operative

* I dati MySQL persistono in `./database`
* Le variabili `MYSQL_*` sono lette da MySQL **solo al primo avvio** del volume
* Il backend deve esporre `/health` (già usato nell’healthcheck)
* In produzione `REFRESH_COOKIE_SECURE=true` (cookie inviati solo su HTTPS)
* `CORS_ORIGINS` include `https://${DOMAIN}`; puoi aggiungere altri origin direttamente nel `.env`
* Il **backup gate** dipende dall’heartbeat scritto da `db_backup` in `/status/last_ok` (verifica che lo script aggiorni l’heartbeat a fine backup)

---

## 11) Aggiornamenti dell’applicazione

```bash
git pull
# (opzionale) aggiorna requirements / package.json

docker compose build --no-cache

docker compose up -d
```

---

## 12) Troubleshooting essenziale

* **404 su `/.well-known/acme-challenge/...`** → verifica i volumi `nginx/certbot/www` e la sezione server su porta 80
* **Certificati non trovati** → verifica che esista `nginx/certbot/conf/live/${DOMAIN}/...` e che `server_name` combaci
* **CORS/cookie** → `CORS_ORIGINS` deve includere l’origin pubblico HTTPS; cookie con `Secure` e `SameSite` appropriati
* **502/504** → controlla reachability da Nginx verso `frontend:3000` e `backend:8000` (stessa network), e la sentinella `sentinel:8080`
