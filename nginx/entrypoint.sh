#!/bin/sh
set -eu
: "${DOMAIN:?DOMAIN not set}"

CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
  # certificates already present -> use SSL configuration
  envsubst '$DOMAIN' < /etc/nginx/templates/ssl.conf.template > /etc/nginx/conf.d/default.conf
else
  # No certificates -> use HTTP-only bootstrap to enable only port 80 and allow certbot to
  # perform the HTTP challenge
  envsubst '$DOMAIN' < /etc/nginx/templates/http.conf.template > /etc/nginx/conf.d/default.conf
fi

exec nginx -g 'daemon off;'