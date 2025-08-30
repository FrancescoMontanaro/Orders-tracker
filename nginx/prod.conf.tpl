# HTTP: ACME + redirect to HTTPS
server {
  listen 80;
  server_name ${DOMAIN};

  location /.well-known/acme-challenge/ { root /var/www/certbot; }

  location / { return 301 https://$host$request_uri; }
}

# HTTPS reverse proxy with backup gate
server {
  listen 443 ssl;
  http2 on;
  server_name ${DOMAIN};

  ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers on;

  # --- Backup gate ---
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

  # Health bypass (optional)
  location = /api/health {
    rewrite ^/api/?(.*)$ /$1 break;
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Frontend (gated)
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

  # Backend (gated)
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