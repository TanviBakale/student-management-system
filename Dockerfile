# Root Dockerfile for Render Container Web Service
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=10000

# Copy backend package manifests and install dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source files
COPY backend/ ./

# Expose Render port
EXPOSE 10000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-10000}/health || exit 1

CMD ["node", "server.js"]
