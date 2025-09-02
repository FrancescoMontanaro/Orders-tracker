# Deploy su VPS **solo HTTP** e **senza dominio** (Next.js + FastAPI + MySQL + Nginx)

> **Obiettivo:** pubblicare l’app su un VPS **senza certificati** e **senza dominio**. Accesso via **IP pubblico** (es. `http://203.0.113.10/`). Configurazione con Docker Compose, MySQL persistente, healthcheck essenziali e **backup gate (sentinel)**.

---

## 1) Prerequisiti

* VPS con **Docker** e **Docker Compose** installati.
* IP pubblico raggiungibile.
* Porta **80/TCP** aperta (e facoltativamente **3306** se vuoi esporre MySQL — sconsigliato).

Setup rapido (Ubuntu):

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # logout/login dopo
sudo apt install -y docker-compose-plugin ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
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
├── backup/
│   └── Dockerfile
├── sentinel/
│   └── Dockerfile
├── nginx/
│   └── dev.conf                   # HTTP‑only + backup gate
├── docker-compose.yml
├── .env                           # unico file di configurazione (root)
└── database/                      # dati MySQL (bind mount)
```

> Non servono file Certbot o cartelle `letsencrypt` in questo scenario.

---

## 3) File `.env` (root)

> Mantieni **un solo** `.env`. Per il deploy solo‑HTTP imposta `COMPOSE_PROFILES=dev` e **non** valorizzare certificati/dominio.

```dotenv
# Profilo Compose: dev = HTTP, prod = HTTPS+Certbot
COMPOSE_PROFILES=dev

# Frontend
NEXT_PUBLIC_COMPANY_NAME=La Tua Azienda

# (Opzionale) Dominio/email usati SOLO in prod
DOMAIN=
LETSENCRYPT_EMAIL=

# Database MySQL
MYSQL_DATABASE=orders
MYSQL_PORT=3306
MYSQL_USER=orders_user
MYSQL_PASSWORD=strongpass
MYSQL_ROOT_PASSWORD=strongroot

# Backup (Restic)
RESTIC_PASSWORD=supersecret
RESTIC_REPOSITORY=s3:s3.amazonaws.com/il-tuo-bucket
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-west-1

# Backend security
SECRET_KEY=super-secret-key
REGISTRATION_PASSWORD_HASH=...
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXP_MINUTES=15
REFRESH_TOKEN_EXP_DAYS=7

# Cookie/CORS in HTTP: niente Secure
REFRESH_COOKIE_SECURE=false
```

> In HTTP puro puoi lasciare `CORS_ORIGINS` vuoto (`[]`) o popolarlo con IP/porta da cui chiami l’API.

---

## 4) Nginx reverse proxy (HTTP‑only, con backup gate)

**`nginx/dev.conf`**

```nginx
server {
  listen 80 default_server;
  server_name _;

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
    proxy_set_header X-Forwarded-Proto http;
  }

  # Frontend (protected by the gate)
  location / {
    auth_request /__backup_gate__;
    proxy_pass http://frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto http;
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
    proxy_set_header X-Forwarded-Proto http;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  client_max_body_size 20m;
}
```

> Se vuoi esporre file statici locali su un percorso (es. `/static/`), aggiungi una `location` dedicata con `root`.

---

## 5) Docker Compose (profilo `dev`)

> Coerente col progetto attuale. Il profilo `dev` espone solo **Nginx HTTP** con `dev.conf`. Nessun servizio Certbot/letsencrypt.

```yaml
services:
  db:
    image: mysql:8.0
    container_name: orders_tracker_db
    command: --default-authentication-plugin=mysql_native_password --innodb_flush_log_at_trx_commit=1 --innodb_flush_method=O_DIRECT
    environment:
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
    volumes:
      - ./database:/var/lib/mysql
    ports:
      - "3306:3306"       # valuta se rimuoverlo in produzione
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h localhost -u$$MYSQL_USER -p$$MYSQL_PASSWORD --silent"]
      interval: 5s
      timeout: 3s
      retries: 20
    networks: [app-net]
    restart: unless-stopped

  db_backup:
    build:
      context: ./backup
      dockerfile: Dockerfile
    container_name: orders_tracker_db_backup
    environment:
      TZ: Europe/Rome
      MYSQL_HOST: db
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY}
      RESTIC_PASSWORD: ${RESTIC_PASSWORD}
      RESTIC_CACHE_DIR: /restic-cache
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_DEFAULT_REGION: ${AWS_REGION}
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./restic/restic_cache:/restic-cache
      - status:/status
    networks: [app-net]
    restart: unless-stopped

  sentinel:
    build:
      context: ./sentinel
      dockerfile: Dockerfile
    container_name: orders_tracker_backup_sentinel
    environment:
      TZ: Europe/Rome
      SENTINEL_THRESHOLD_SECONDS: "93600"
      SENTINEL_BOOT_GRACE_SECONDS: "86400"
      SENTINEL_HEARTBEAT_PATH: "/status/last_ok"
    volumes:
      - status:/status:ro
    expose: ["8080"]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:8080/health || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 12
    networks: [app-net]
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: orders_tracker_backend
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
      CORS_ORIGINS: '[]'               # in HTTP-only puoi lasciare vuoto
      REFRESH_COOKIE_SECURE: ${REFRESH_COOKIE_SECURE}
      REFRESH_COOKIE_DOMAIN: ''        # nessun dominio in HTTP-only
    depends_on:
      db:
        condition: service_healthy
    expose: ["8000"]
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
      args:
        NEXT_PUBLIC_COMPANY_NAME: ${NEXT_PUBLIC_COMPANY_NAME}
        NEXT_PUBLIC_API_BASE_URL: /api
        NEXT_PUBLIC_SITE_URL: http://localhost
    container_name: orders_tracker_frontend
    depends_on:
      backend:
        condition: service_healthy
    expose: ["3000"]
    networks: [app-net]
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: orders_tracker_nginx_dev
    profiles: ["dev"]
    depends_on:
      - frontend
      - backend
      - sentinel
    ports:
      - "80:80"
    volumes:
      - ./nginx/dev.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [app-net]
    restart: unless-stopped

volumes:
  status: {}

networks:
  app-net:
    driver: bridge
```

---

## 6) Build & Avvio

Assicurati che nel `.env` ci sia `COMPOSE_PROFILES=dev`.

```bash
docker compose build --no-cache
docker compose up -d
```

Verifica:

* Frontend → `http://<IP_VPS>/`
* Backend health → `http://<IP_VPS>/api/health`

> Se vedi 503, il **backup gate** sta bloccando l’accesso: controlla che `db_backup` aggiorni lo `status/last_ok` (heartbeat) e che `SENTINEL_*` siano corretti.

---

## 7) Note operative

* I dati MySQL persistono in `./database`.
* Le variabili `MYSQL_*` sono lette **solo alla prima inizializzazione** del volume dati.
* In HTTP i cookie con flag **Secure** non vengono inviati: per questo `REFRESH_COOKIE_SECURE=false`.
* Per passare a HTTPS e dominio pubblico, usa la **guida prod** (Nginx + Certbot) e imposta `COMPOSE_PROFILES=prod`.

---

## 8) Aggiornamenti

```bash
git pull
docker compose build --no-cache
docker compose up -d
```