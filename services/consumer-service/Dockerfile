# Stage 1: Build dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Copy shared database package and files
COPY shared/database/package*.json ./shared/database/
WORKDIR /app/shared/database
RUN npm ci --only=production

# Copy consumer-service package and files
WORKDIR /app
COPY services/consumer-service/package*.json ./services/consumer-service/
WORKDIR /app/services/consumer-service
RUN npm ci --only=production

# Copy source code
WORKDIR /app
COPY shared/database ./shared/database
COPY services/consumer-service ./services/consumer-service

# Stage 2: Final minimal image
FROM node:20-alpine
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/shared/database ./shared/database
COPY --from=builder /app/services/consumer-service ./services/consumer-service

WORKDIR /app/services/consumer-service

EXPOSE 3002
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && chown -R appuser:appgroup /app
USER appuser
CMD ["node", "server.js"]
