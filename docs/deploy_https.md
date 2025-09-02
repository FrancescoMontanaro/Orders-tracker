# Deploy su VPS con **dominio** e **HTTPS** (Next.js + FastAPI + MySQL + Nginx)

> **Obiettivo:** pubblicare l’app su un VPS tramite Docker Compose, con reverse proxy Nginx e certificati TLS Let’s Encrypt. Tutto è parametrizzato dal file **`.env` unico** in root e dai profili Compose.

---

## 1) Prerequisiti

* VPS con **Docker** e **Docker Compose** installati.
* Dominio con record **A/AAAA** puntato all’IP del VPS.
* Porte **80** e **443** aperte sul firewall.

Setup rapido (Ubuntu):

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER  # logout/login dopo
sudo apt install -y docker-compose-plugin ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 2) Struttura cartelle del progetto

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
│   ├── entrypoint.sh                     # decide HTTP-only o SSL e avvia Nginx
│   ├── prod.http-bootstrap.template      # server :80 (ACME + redirect)
│   └── prod.ssl.template                 # full HTTPS + backup gate
├── certbot/
│   ├── entrypoint.sh                     # attende :80, emette e rinnova con hook
│   └── www/                              # webroot ACME
├── database/                             # dati MySQL (bind mount)
├── restic/                               # cache backup (opzionale)
├── docker-compose.yml
└── .env                                  # unico file di configurazione
```

---

## 3) File `.env` (unico, in root)

> Imposta **tutte** le variabili qui. In produzione usa `COMPOSE_PROFILES=prod`.

```dotenv
# Dominio pubblico e email per Let’s Encrypt
DOMAIN=esempio.tld
LETSENCRYPT_EMAIL=admin@esempio.tld

# Profili docker compose: dev (HTTP), prod (HTTPS + certbot)
COMPOSE_PROFILES=prod

# Frontend
NEXT_PUBLIC_COMPANY_NAME=La Tua Azienda

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

# Cookie/CORS
REFRESH_COOKIE_SECURE=true
```

> Il backend riceve `CORS_ORIGINS` dal Compose come JSON che include `https://${DOMAIN}`.

---

## 4) Template Nginx

### `nginx/prod.http-bootstrap.template` (HTTP‑only per ACME)

```nginx
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;

  # ACME challenge (no redirect)
  location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    try_files $uri =404;
  }

  # Redirect tutto il resto a HTTPS
  location / {
    return 301 https://$host$request_uri;
  }
}
```

### `nginx/prod.ssl.template` (HTTPS completo + backup gate)

```nginx
# Mantieni :80 per ACME + redirect
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;

  location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    try_files $uri =404;
  }
  location / { return 301 https://$host$request_uri; }
}

# :443 — full app
server {
  listen 443 ssl;
  http2 on;
  server_name $DOMAIN www.$DOMAIN;

  ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  # (opzionale) HSTS una volta validato HTTPS
  # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  # ACME anche su HTTPS (sicuro)
  location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    try_files $uri =404;
  }

  # -------- Backup gate --------
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

  location = /__unavailable__ {
    return 503 "Service unavailable: backup status not OK.\n";
    add_header Retry-After 3600;
    default_type text/plain;
  }

  proxy_intercept_errors on;
  error_page 401 403 500 502 503 504 =503 /__unavailable__;

  # Health backend (senza gate)
  location = /api/health {
    rewrite ^/api/?(.*)$ /$1 break;
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  # Frontend (con gate)
  location / {
    auth_request /__backup_gate__;
    proxy_pass http://frontend:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  # API (con gate) sotto /api (rewrite prefisso)
  location /api/ {
    auth_request /__backup_gate__;
    rewrite ^/api/?(.*)$ /$1 break;
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  client_max_body_size 20m;
}
```

---

## 5) Entrypoint script

### `nginx/entrypoint.sh`

```sh
#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN not set}"

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  # Certificati presenti → config SSL completa
  envsubst '$DOMAIN' < /etc/nginx/templates/ssl.conf.template > /etc/nginx/conf.d/default.conf
else
  # Nessun certificato → bootstrap HTTP per ACME
  envsubst '$DOMAIN' < /etc/nginx/templates/http.conf.template > /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'
```

### `certbot/entrypoint.sh`

```sh
#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN not set}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL not set}"

WEBROOT="/var/www/certbot"
NGINX_HOST="orders_tracker_nginx_prod"
NGINX_PORT=80

echo "[certbot] Waiting for nginx at ${NGINX_HOST}:${NGINX_PORT}..."
python3 - <<'PY'
import socket, time, os, sys
host = os.environ.get("NGINX_HOST", "orders_tracker_nginx_prod")
port = int(os.environ.get("NGINX_PORT","80"))
for _ in range(120):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("[certbot] nginx is up")
            sys.exit(0)
    except Exception:
        time.sleep(1)
print("[certbot] nginx did not become ready in time", file=sys.stderr)
sys.exit(1)
PY

echo "[certbot] Issuing/validating certificate for ${DOMAIN} and www.${DOMAIN}..."
certbot certonly --webroot -w "$WEBROOT" \
  --email "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive \
  -d "$DOMAIN" -d "www.$DOMAIN" || true

# Rinnovo con deploy-hook che ricarica Nginx (richiede docker.sock montato)
echo "[certbot] Entering renew loop..."
while :; do
  certbot renew --webroot -w "$WEBROOT" --quiet \
    --deploy-hook "docker kill -s HUP orders_tracker_nginx_prod || true" \
    || true
  sleep 12h
done
```

> **Nota:** in fase di test, se becchi i rate‑limit di Let’s Encrypt, aggiungi `--staging` a `certonly` e `renew`, poi rimuovilo per i certificati reali.

Rendi eseguibili gli script:

```bash
chmod +x nginx/entrypoint.sh certbot/entrypoint.sh
```

---

## 6) Estratto `docker-compose.yml` (servizi Nginx + Certbot)

> Coerente con la tua ultima versione. **Stesso volume named `letsencrypt`** su entrambi; `docker.sock` montato su Certbot per il deploy‑hook.

```yaml
  nginx_prod:
    image: nginx:alpine
    container_name: orders_tracker_nginx_prod
    profiles: ["prod"]
    environment:
      DOMAIN: ${DOMAIN}
    depends_on:
      - frontend
      - backend
      - sentinel
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/entrypoint.sh:/docker-entrypoint-custom.sh:ro
      - ./nginx/prod.http-bootstrap.template:/etc/nginx/templates/http.conf.template:ro
      - ./nginx/prod.ssl.template:/etc/nginx/templates/ssl.conf.template:ro
      - letsencrypt:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: ["/bin/sh", "/docker-entrypoint-custom.sh"]
    networks: [app-net]
    restart: unless-stopped

  certbot_renew:
    image: certbot/certbot:latest
    container_name: orders_tracker_certbot
    profiles: ["prod"]
    depends_on:
      - nginx_prod
    environment:
      DOMAIN: ${DOMAIN}
      LETSENCRYPT_EMAIL: ${LETSENCRYPT_EMAIL}
      NGINX_HOST: orders_tracker_nginx_prod
      NGINX_PORT: "80"
    volumes:
      - ./certbot/entrypoint.sh:/docker-entrypoint-custom.sh:ro
      - ./certbot/www:/var/www/certbot
      - letsencrypt:/etc/letsencrypt
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: ["/bin/sh", "/docker-entrypoint-custom.sh"]
    networks: [app-net]
    restart: unless-stopped
```

*(Gli altri servizi — db, db\_backup, sentinel, backend, frontend, nginx dev — restano come da compose del progetto.)*

---

## 7) Build & primo avvio

```bash
# 1) Build immagini
docker compose build --no-cache

# 2) Avvio profilo prod (parte Nginx; se non trova i cert, usa HTTP-only)
docker compose --profile prod up -d

# 3) Verifica ACME webroot
docker compose exec orders_tracker_certbot sh -lc \
  'mkdir -p /var/www/certbot/.well-known/acme-challenge && \
   echo OK > /var/www/certbot/.well-known/acme-challenge/ping'

curl -I http://$DOMAIN/.well-known/acme-challenge/ping
# Atteso: HTTP/1.1 200 OK

# 4) Dopo la prima emissione, passa a SSL (reload/start)
docker compose restart orders_tracker_nginx_prod
```

---

## 8) Verifica

* Frontend → `https://${DOMAIN}/`
* Backend health → `https://${DOMAIN}/api/health`

---

## 9) Rinnovo automatico

* `certbot_renew` tenta il rinnovo ogni 12h.
* Se il rinnovo avviene, il **deploy‑hook** esegue `docker kill -s HUP orders_tracker_nginx_prod` → Nginx ricarica i cert senza downtime.
* Test rinnovo (staging):

```bash
docker compose run --rm certbot_renew certbot renew --dry-run
```

---

## 10) Aggiornamenti applicazione

```bash
git pull
# (opzionale) aggiorna requirements / package.json

docker compose build --no-cache

docker compose up -d
```

---

## 11) Troubleshooting rapido

* **`unknown "domain" variable` in Nginx** → nel template usa **`$DOMAIN`** (maiuscolo) e rendi il file via `envsubst` (lo fa l’entrypoint). Non usare `$domain`.
* **`envsubst: Is a directory`** → stai montando una dir al posto del file template; verifica i path `volumes`.
* **Challenge HTTP 404/connection refused** → controlla il blocco `/.well-known/acme-challenge/` su :80 e i volumi `./certbot/www:/var/www/certbot`.
* **Cert non visti da Nginx** → entrambi devono montare **lo stesso** volume `letsencrypt:/etc/letsencrypt`.
* **Rate limit Let’s Encrypt** → usa `--staging` in `certonly`/`renew` per test; rimuovi dopo.
* **Cookie/CORS** → assicurati che `CORS_ORIGINS` contenga `https://${DOMAIN}` e che `REFRESH_COOKIE_SECURE=true` in prod.
* **502/504** → verifica reachability dai container Nginx → `frontend:3000`, `backend:8000`, `sentinel:8080` (stessa rete `app-net`).

---

## 12) Note di sicurezza

* Montare `/var/run/docker.sock` in certbot abilita il reload automatico: comodo ma con privilegi elevati. Alternativa: rimuovi il mount e gestisci il reload da un **cron sul host** (`docker kill -s HUP orders_tracker_nginx_prod`).
* Valuta l’abilitazione di **HSTS** dopo aver verificato che tutto il traffico sia su HTTPS.
