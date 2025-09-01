#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN not set}"
: "${LETSENCRYPT_EMAIL:?LETSENCRYPT_EMAIL not set}"

WEBROOT="/var/www/certbot"
NGINX_HOST="orders_tracker_nginx_prod"
NGINX_PORT=80

echo "[certbot] Waiting for nginx at ${NGINX_HOST}:${NGINX_PORT}..."

# Usa Python to wait on TCP
python3 - <<'PY'
import socket, time, os, sys
host = os.environ.get("NGINX_HOST", "orders_tracker_nginx_prod")
port = int(os.environ.get("NGINX_PORT","80"))
for i in range(120):  # fino a ~2 minuti
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

# During testing, if rate-limit has been reached, add --staging to these two lines and try again later.
certbot certonly --webroot -w "$WEBROOT" \
  --email "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive \
  -d "$DOMAIN" -d "www.$DOMAIN" || true

echo "[certbot] Entering renew loop..."
while :; do
  certbot renew --webroot -w "$WEBROOT" --quiet || true
  sleep 12h
done