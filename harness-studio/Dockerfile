# ============================================================
# Harness Studio — Docker image for Zeabur / Railway deployment
# Simple and reliable: full node_modules (no standalone pitfalls)
# ============================================================

# ---- Stage 1: Install all deps + build ----
FROM node:20-slim AS builder
WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Stage 2: Production runner ----
FROM node:20-slim AS runner
WORKDIR /app

# Runtime: better-sqlite3 native module needs libstdc++
RUN apt-get update && apt-get install -y \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create data directory for persistent SQLite
RUN mkdir -p /data

# Copy built app with all node_modules (native modules included)
COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "start"]
