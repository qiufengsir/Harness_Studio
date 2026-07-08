# ============================================================
# Harness Studio — Docker image for Railway deployment
# Uses full Debian for better native module compatibility
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

# Ensure public directory exists (Next.js expects it at runtime)
RUN mkdir -p /app/public

FROM node:20 AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    libstdc++6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN mkdir -p /data

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD curl -f http://localhost:3000/api/llm-test || exit 1

CMD ["npm", "start"]
