#!/bin/bash
set -e

echo "=== VaultMind starting ==="
echo "Node $(node -v)"

# ── 1. Prisma: ensure schema is synced ────────────────────────
echo "[boot] Syncing Prisma schema..."
npx prisma db push --skip-generate 2>&1 || echo "[boot] Prisma push failed (non-fatal — tables may already exist)"

# ── 2. OpenClaw Gateway (background) ─────────────────────────
if command -v openclaw &> /dev/null && [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "[boot] Starting OpenClaw Gateway on :18789..."

  # Generate gateway token if not set
  if [ -z "$OPENCLAW_GATEWAY_TOKEN" ]; then
    export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
    echo "[boot] Generated OPENCLAW_GATEWAY_TOKEN"
  fi

  # Register agents (idempotent — skips if already registered)
  AGENTS=(
    "main-orchestrator:main-agent"
    "sentiment:sentiment-agent"
    "whale:whale-agent"
    "momentum:momentum-agent"
    "alpha:alpha-agent"
    "risk:risk-agent"
    "executor:executor-agent"
    "memecoin-hunter:memecoin-hunter"
    "twitter-alpha:twitter-alpha"
    "defi-yield:defi-yield"
    "news-scanner:news-scanner"
    "onchain-forensics:onchain-forensics"
    "options-flow:options-flow"
    "macro-correlator:macro-correlator"
  )

  for entry in "${AGENTS[@]}"; do
    IFS=":" read -r agent_id workspace <<< "$entry"
    openclaw agents add "$agent_id" --workspace "./openclaw/$workspace" --non-interactive 2>/dev/null || true
  done

  echo "[boot] Registered $(openclaw agents list 2>/dev/null | wc -l) agents"

  # Start gateway in background
  openclaw gateway --port 18789 &
  GATEWAY_PID=$!
  echo "[boot] OpenClaw Gateway PID: $GATEWAY_PID"

  # Wait for gateway to be ready
  for i in $(seq 1 10); do
    if curl -sf http://127.0.0.1:18789/ > /dev/null 2>&1; then
      echo "[boot] Gateway ready"
      break
    fi
    sleep 1
  done
else
  echo "[boot] OpenClaw not available or ANTHROPIC_API_KEY not set — skipping Gateway"
fi

# ── 3. Specialist servers (background) ───────────────────────
echo "[boot] Starting specialist servers (:4001-4010)..."
tsx src/agents/specialist-server.ts &
SPEC_PID=$!
echo "[boot] Specialists PID: $SPEC_PID"

# ── 4. Backend: Telegram bot + heartbeat (background) ────────
echo "[boot] Starting backend (Telegram + heartbeat)..."
tsx src/index.ts &
BACKEND_PID=$!
echo "[boot] Backend PID: $BACKEND_PID"

# ── 5. Next.js dashboard (foreground — Railway health check) ─
echo "[boot] Starting Next.js on :${PORT:-3000}..."
exec node server.js
