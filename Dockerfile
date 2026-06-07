# ============================================================
# Chat2API Docker - Proxy Server (No GUI)
# ============================================================

# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (dev + prod)
RUN npm ci --ignore-scripts

# Copy source code and config
COPY tsconfig.json tsconfig.node.json ./
COPY electron.vite.config.ts vite.config.ts ./
COPY postcss.config.js tailwind.config.js components.json ./
COPY src/ ./src/
COPY sha3_wasm_bg.7b9ca65ddd.wasm ./

# Build main process (preload failure is expected - we don't need it)
RUN npx electron-vite build 2>&1 || true
# Verify main process was built
RUN test -f out/main/index.js && echo "Main process built successfully" || (echo "Build failed" && exit 1)

# ============================================================
# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install production dependencies + tsx for running TypeScript
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
RUN npm install --save-dev tsx --ignore-scripts

# Replace electron module with our mock (electron binary not available in Docker)
COPY src/docker/electron-mock-runtime.js ./node_modules/electron/index.js
# Replace electron-store with our JSON file store (ESM format)
COPY src/docker/store-mock-runtime.mjs ./node_modules/electron-store/index.js

# Copy compiled output (for any bundled assets)
COPY --from=builder /app/out/ ./out/

# Copy TypeScript source needed at runtime (main process + shared types)
COPY src/main/ ./src/main/
COPY src/shared/ ./src/shared/
COPY src/docker/ ./src/docker/

# Copy TypeScript configs
COPY tsconfig.json tsconfig.node.json ./

# Copy WASM file
COPY --from=builder /app/sha3_wasm_bg.7b9ca65ddd.wasm ./

# Create data directory
RUN mkdir -p /root/.chat2api

# Environment
ENV NODE_ENV=production
ENV CHAT2API_PORT=18050
ENV CHAT2API_HOST=0.0.0.0
ENV CHAT2API_LOG_LEVEL=info

EXPOSE 18050 18051

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:18050/health || exit 1

# Start: run TypeScript entry with tsx (electron module already replaced in node_modules)
CMD ["npx", "tsx", "./src/docker/index.ts"]
