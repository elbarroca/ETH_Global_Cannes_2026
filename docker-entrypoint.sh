#!/bin/bash
set -e

echo "=== AlphaDawg Agent Swarm ==="
echo "Node $(node -v) | 14 OpenClaw agents | 0G Compute TEE"
echo "Provider: ${OG_PROVIDER_ADDRESS:-not set}"

# ── 1. Specialist servers (background) ────────────────────────
# 10 agents on :4001-4010, each with x402 paywall + 0G sealed inference
echo "[boot] Starting 10 specialist agents..."
tsx src/agents/specialist-server.ts &
SPEC_PID=$!

# Wait a moment for specialists to bind ports
sleep 2

# ── 2. Backend: Telegram bot + heartbeat + timeout checker ────
# This is the main process — coordinates the swarm
echo "[boot] Starting swarm orchestrator (Telegram + heartbeat)..."
exec tsx src/index.ts
