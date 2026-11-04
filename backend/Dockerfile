# Production Docker container for Student Management System API
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=10000

# Install dependencies (utilizing layer caching)
COPY package*.json ./
RUN npm ci --only=production

# Copy backend source files
COPY . .

# Expose default Render port
EXPOSE 10000

# Health check instruction
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-10000}/health || exit 1

# Start the Express server
CMD ["node", "server.js"]
