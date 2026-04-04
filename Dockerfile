# ═══════════════════════════════════════
# VaultMind — Railway Multi-Process Dockerfile
# Next.js (dashboard) + Backend (Telegram/heartbeat) + Specialists (x402)
# ═══════════════════════════════════════

# ── Stage 1: Dependencies ──────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 make g++ git curl openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps
RUN npx prisma generate

# ── Stage 2: Build ─────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

# Next.js needs NEXT_PUBLIC_* at build time (they're inlined into the JS bundle)
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
ARG NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=""
ARG NEXT_PUBLIC_HCS_TOPIC_ID=""
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=""
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=$NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID
ENV NEXT_PUBLIC_HCS_TOPIC_ID=$NEXT_PUBLIC_HCS_TOPIC_ID
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js (standalone output)
RUN npm run build

# ── Stage 3: Production ───────────────────────────────────────
FROM node:22-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# Install OpenClaw globally
RUN npm install -g openclaw tsx

# Copy Next.js standalone + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy source for backend (tsx runs TypeScript directly)
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy OpenClaw agent workspaces + config
COPY --from=builder /app/openclaw ./openclaw

# Copy entrypoint
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Railway exposes this port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./docker-entrypoint.sh"]
