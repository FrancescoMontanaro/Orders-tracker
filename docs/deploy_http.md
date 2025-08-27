# Deploy su VPS **solo HTTP** e **senza dominio** (Next.js + FastAPI + MySQL + Nginx)

> **Obiettivo**: pubblicazione su VPS senza certificati e senza dominio. Accesso via **IP pubblico** (es. `http://203.0.113.10/`). Configurazione basata sul `docker-compose.yml` fornito, mantenendo bind mount MySQL e healthcheck.

---

## 1) Prerequisiti

* VPS con Docker e Docker Compose installati.
* IP pubblico raggiungibile.
* Porta **80** aperta nel firewall.

Esempio (Ubuntu):

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# logout/login della sessione per applicare il gruppo

sudo apt install -y docker-compose-plugin ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw enable
```

---

## 2) Struttura cartelle

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
└── database/              # dati MySQL persistenti (bind mount)
```

> `database/` è montata in `/var/lib/mysql` del container MySQL.

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

# CORS (IP del VPS su HTTP)
BACKEND_CORS_ORIGINS=["http://<IP_VPS>", "http://localhost"]

# Registrazione protetta (SHA-256 della registration password)
REGISTRATION_PASSWORD_HASH=<<sha256-hex>>
```

### 3.2 Frontend (`frontend/.env.production`)

```env
NEXT_PUBLIC_COMPANY_NAME="<<nome-company>>"
NEXT_PUBLIC_API_BASE_URL=/api
```

> Next.js legge `.env.production` in build; assicurarsi che il file non sia ignorato dal `.dockerignore`.

### 3.3 Database (`database/.env.production`)

```env
DB_USER="<<nome-utente-db>>"
DB_PASSWORD="<<password-db>>"
DB_HOST="db"
DB_PORT="3306"
DB_NAME="orders_tracker"
```

---

## 4) Nginx reverse proxy (solo HTTP)

File `nginx/default.conf` (server di default, nessun dominio):

```nginx
server {
  listen 80 default_server;
  server_name _;

  # Proxy al frontend Next.js (root)
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

## 5) `docker-compose.yml` (HTTP-only, adattato)

Configurazione aggiornata per funzionamento su porta 80 (senza 443, senza certbot).

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
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    networks: [app-net]
    restart: unless-stopped

networks:
  app-net:
    driver: bridge
```

---

## 6) Build e avvio

```bash
docker compose build --no-cache

docker compose up -d
```

Verifica:

* Frontend: `http://<IP_VPS>/`
* Backend (health): `http://<IP_VPS>/api/health`

---

## 7) Note operative

* I dati MySQL persistono nella cartella locale `./database`. Un riavvio o ricreazione dei container non li elimina.
* Le variabili `MYSQL_*` sono lette solo al primo avvio del volume MySQL; in seguito, modifiche richiedono intervento sul DB o reset del volume.
* In assenza di HTTPS, i cookie con flag `Secure` non verranno inviati dal browser; configurazioni di autenticazione basate su cookie `httpOnly` devono tenerne conto.
* Se in futuro occorre passare a HTTPS e dominio, sostituire questa guida con la variante con certificati (aggiunta della porta 443, volumi Let’s Encrypt, server\_name, ecc.).

---

## 8) Aggiornamenti

```bash
git pull

docker compose build

docker compose up -d
```
