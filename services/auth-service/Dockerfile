# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared database package and files
COPY shared/database/package*.json ./shared/database/
WORKDIR /app/shared/database
RUN npm ci --only=production

# Copy auth-service package and files
WORKDIR /app
COPY services/auth-service/package*.json ./services/auth-service/
WORKDIR /app/services/auth-service
RUN npm ci --only=production

# Copy source code
WORKDIR /app
COPY shared/database ./shared/database
COPY services/auth-service ./services/auth-service

# Stage 2: Final minimal image
FROM node:20-alpine
WORKDIR /app

# Upgrade Alpine OS packages to remediate CVEs (libssl3/libcrypto3)
RUN apk upgrade --no-cache libssl3 libcrypto3

# Copy built artifacts from builder
COPY --from=builder /app/shared/database ./shared/database
COPY --from=builder /app/services/auth-service ./services/auth-service

WORKDIR /app/services/auth-service

# Upgrade npm (fixes bundled tar CVEs) and patch transitive dep CVEs in app node_modules
RUN npm install -g npm@latest && \
    npm install cross-spawn@7.0.5 minimatch@9.0.6 glob@10.5.0 --no-save --no-audit --no-fund

EXPOSE 3001
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "server.js"]