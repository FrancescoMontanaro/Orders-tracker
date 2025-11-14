# -------------------------
# Build stage
# -------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Build-time args injected from docker-compose.yml
# (compose -> frontend.build.args.*)
ARG NEXT_PUBLIC_COMPANY_NAME
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL

# Make them visible to Next at build time
ENV NEXT_PUBLIC_COMPANY_NAME=${NEXT_PUBLIC_COMPANY_NAME}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies
COPY package*.json ./
RUN npm ci

# App sources
COPY . .

# Build (standalone output expected: .next/standalone + .next/static)
RUN npm run build

# -------------------------
# Runtime stage
# -------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Needed by sharp on Alpine (Next Image Optimization)
RUN apk update && apk add --no-cache gcompat

# Copy Next standalone artifacts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Security: run as non-root
USER node

# Expose and run
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]