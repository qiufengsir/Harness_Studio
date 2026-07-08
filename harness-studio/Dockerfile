# ============================================================
# Harness Studio — Docker image for Railway deployment
# Uses Next.js standalone output mode (recommended for Docker)
# Build context: repository root (harness-studio/ is a subdirectory)
# ============================================================

FROM node:20 AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libsqlite3-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY harness-studio/package.json harness-studio/package-lock.json* ./
RUN npm ci

COPY harness-studio/. .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

RUN npm rebuild better-sqlite3

# Ensure public directory exists for runner COPY
RUN mkdir -p /app/public

# ---- Runner ----
FROM node:20 AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/dev.db

RUN mkdir -p /data /app/public

# Standalone server (includes minimal node_modules bundled by Next.js)
COPY --from=builder /app/.next/standalone ./
# Static assets
COPY --from=builder /app/.next/static ./.next/static
# Public directory (empty but expected by Next.js)
COPY --from=builder /app/public ./public

# better-sqlite3 is in serverExternalPackages, so NOT bundled in standalone.
# Copy the native module and its dependency chain.
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

EXPOSE 3000

CMD ["node", "server.js"]
