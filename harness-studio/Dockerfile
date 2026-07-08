# ============================================================
# Harness Studio — Docker image for Railway deployment
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

# Ensure public directory exists
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
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/dev.db

RUN mkdir -p /data

# Copy all necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

# Railway injects PORT env var — use it explicitly
CMD ["sh", "-c", "npx next start --port ${PORT:-3000} --hostname 0.0.0.0"]
