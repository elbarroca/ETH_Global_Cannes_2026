#!/bin/bash
# Deploy ALL 13 agents to Fly.io (main-agent stays on Railway)
# Usage: ./fly/deploy-all.sh
# Deploys in parallel batches of 4

set -e

AGENTS=(
  # Specialists (10)
  sentiment whale momentum memecoin-hunter twitter-alpha
  defi-yield news-scanner onchain-forensics options-flow macro-correlator
  # Adversarial (3)
  alpha risk executor
)

echo "=== Deploying ${#AGENTS[@]} agents to Fly.io ==="
echo ""

# Deploy in batches of 4
BATCH_SIZE=4
for ((i=0; i<${#AGENTS[@]}; i+=BATCH_SIZE)); do
  BATCH=("${AGENTS[@]:i:BATCH_SIZE}")
  echo "--- Batch: ${BATCH[*]} ---"

  for agent in "${BATCH[@]}"; do
    ./fly/deploy-agent.sh "$agent" &
  done

  # Wait for batch to complete
  wait
  echo "--- Batch complete ---"
  echo ""
done

echo ""
echo "=== ALL ${#AGENTS[@]} AGENTS DEPLOYED ==="
echo ""
echo "Add these to Railway env vars:"
for agent in "${AGENTS[@]}"; do
  ENV_KEY="AGENT_URL_${agent^^}"
  ENV_KEY="${ENV_KEY//-/_}"
  echo "  ${ENV_KEY}=https://vm-${agent}.fly.dev"
done
