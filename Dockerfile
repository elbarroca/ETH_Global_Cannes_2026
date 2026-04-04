# ═══════════════════════════════════════
# AlphaDawg — OpenClaw Agent Swarm
# 14 agents on 0G Compute (TEE sealed inference)
# Telegram bot + heartbeat + 10 specialist servers
# ═══════════════════════════════════════
# Next.js (UI + API) runs separately — this is AGENTS ONLY

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

# ── Stage 2: Production ───────────────────────────────────────
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

# tsx for running TypeScript directly
RUN npm install -g tsx

# Runtime deps
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package.json tsconfig.json ./

# Agent source code (backend + specialists + 0G inference)
COPY src ./src

# OpenClaw agent workspaces (SOUL.md, IDENTITY.md, openclaw.json)
COPY openclaw ./openclaw

# Entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Specialist servers: 4001-4010
# Backend API: 3001 (for curl testing, not dashboard)
EXPOSE 3001 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:4001/analyze 2>/dev/null || curl -f http://localhost:3001/api/health 2>/dev/null || exit 1

ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
