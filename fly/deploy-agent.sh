#!/bin/bash
# Deploy a single AlphaDawg agent to Fly.io
# Usage: ./fly/deploy-agent.sh sentiment
# Usage: ./fly/deploy-agent.sh alpha
#
# Prerequisites: flyctl installed + logged in (fly auth login)

set -e

AGENT_NAME=$1
if [ -z "$AGENT_NAME" ]; then
  echo "Usage: $0 <agent-name>"
  echo "Agents: sentiment whale momentum memecoin-hunter twitter-alpha defi-yield"
  echo "        news-scanner onchain-forensics options-flow macro-correlator"
  echo "        alpha risk executor"
  exit 1
fi

APP_NAME="vm-${AGENT_NAME}"
REGION="${FLY_REGION:-cdg}"

echo "=== Deploying ${AGENT_NAME} as ${APP_NAME} to ${REGION} ==="

# Create fly.toml from template
sed "s/FLYAPPNAME/${APP_NAME}/g; s/FLYAGENTNAME/${AGENT_NAME}/g" fly/fly.toml.template > fly.toml

# Create app if it doesn't exist
fly apps create "${APP_NAME}" --org personal 2>/dev/null || echo "App ${APP_NAME} already exists"

# Set secrets (0G keys for sealed inference)
echo "Setting secrets..."
fly secrets set \
  OG_PRIVATE_KEY="${OG_PRIVATE_KEY}" \
  OG_RPC_URL="${OG_RPC_URL:-https://evmrpc-testnet.0g.ai}" \
  OG_PROVIDER_ADDRESS="${OG_PROVIDER_ADDRESS}" \
  OG_STORAGE_INDEXER="${OG_STORAGE_INDEXER:-https://indexer-storage-testnet-turbo.0g.ai}" \
  AGENT_NAME="${AGENT_NAME}" \
  -a "${APP_NAME}" 2>/dev/null || true

# Deploy
echo "Deploying..."
fly deploy --app "${APP_NAME}" --yes

# Clean up fly.toml (it was generated from template)
rm -f fly.toml

echo ""
echo "=== ${AGENT_NAME} deployed ==="
echo "  URL: https://${APP_NAME}.fly.dev"
echo "  Health: https://${APP_NAME}.fly.dev/healthz"
echo "  Analyze: https://${APP_NAME}.fly.dev/analyze"
echo ""
ENV_NAME=$(echo "AGENT_URL_${AGENT_NAME}" | tr '[:lower:]-' '[:upper:]_')
echo "Set in Railway:"
echo "  ${ENV_NAME}=https://${APP_NAME}.fly.dev"
