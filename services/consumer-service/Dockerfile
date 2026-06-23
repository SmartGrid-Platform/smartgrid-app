# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared database package and files
COPY shared/database/package*.json ./shared/database/
WORKDIR /app/shared/database
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.overrides=Object.assign(p.overrides||{},{'cross-spawn':'7.0.5','glob':'10.5.0','minimatch':'9.0.7'});fs.writeFileSync('package.json',JSON.stringify(p,null,2));" \
    && rm -f package-lock.json \
    && npm install --omit=dev --no-audit --ignore-scripts

# Copy consumer-service package and files
WORKDIR /app
COPY services/consumer-service/package*.json ./services/consumer-service/
WORKDIR /app/services/consumer-service
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.overrides=Object.assign(p.overrides||{},{'cross-spawn':'7.0.5','glob':'10.5.0','minimatch':'9.0.7'});fs.writeFileSync('package.json',JSON.stringify(p,null,2));" \
    && rm -f package-lock.json \
    && npm install --omit=dev --no-audit --ignore-scripts

# Copy source code
WORKDIR /app
COPY shared/database ./shared/database
COPY services/consumer-service ./services/consumer-service

# Stage 2: Final minimal image
FROM node:20-alpine
WORKDIR /app

# Upgrade Alpine OS packages (fixes libssl3/libcrypto3 CVE-2026-45447)
RUN apk upgrade --no-cache libssl3 libcrypto3

# Copy built artifacts (includes CVE-patched node_modules from builder)
COPY --from=builder /app/shared/database ./shared/database
COPY --from=builder /app/services/consumer-service ./services/consumer-service

WORKDIR /app/services/consumer-service

EXPOSE 3002
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "server.js"]
