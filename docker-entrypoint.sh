#!/bin/bash
set -e

echo "=== AlphaDawg Agent Swarm ==="
echo "Node $(node -v) | 14 OpenClaw agents | 0G Compute TEE"

# ── 1. Prisma: sync schema ────────────────────────────────────
echo "[boot] Syncing Prisma schema..."
npx prisma db push --skip-generate 2>&1 || echo "[boot] Prisma push skipped (tables may exist)"

# ── 2. Specialist servers (background) ────────────────────────
# 10 agents on :4001-4010, each with x402 paywall + 0G sealed inference
echo "[boot] Starting 10 specialist agents..."
tsx src/agents/specialist-server.ts &
SPEC_PID=$!

# ── 3. Backend: Telegram bot + heartbeat + timeout checker ────
# This is the main process — coordinates the swarm
echo "[boot] Starting swarm orchestrator (Telegram + heartbeat)..."
exec tsx src/index.ts
