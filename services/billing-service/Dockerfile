# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared database package and files
COPY shared/database/package*.json ./shared/database/
WORKDIR /app/shared/database
RUN npm ci --only=production && npm install cross-spawn@7.0.5 minimatch@9.0.7 glob@10.5.0 --no-save --no-package-lock --no-audit --no-fund

# Copy billing-service package and files
WORKDIR /app
COPY services/billing-service/package*.json ./services/billing-service/
WORKDIR /app/services/billing-service
RUN npm ci --only=production && npm install cross-spawn@7.0.5 minimatch@9.0.7 glob@10.5.0 --no-save --no-package-lock --no-audit --no-fund

# Copy source code
WORKDIR /app
COPY shared/database ./shared/database
COPY services/billing-service ./services/billing-service

# Stage 2: Final minimal image
FROM node:20-alpine
WORKDIR /app

# Upgrade Alpine OS packages (fixes libssl3/libcrypto3 CVE-2026-45447)
RUN apk upgrade --no-cache libssl3 libcrypto3

# Copy built artifacts (includes CVE-patched node_modules from builder)
COPY --from=builder /app/shared/database ./shared/database
COPY --from=builder /app/services/billing-service ./services/billing-service

WORKDIR /app/services/billing-service

EXPOSE 3004
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "server.js"]