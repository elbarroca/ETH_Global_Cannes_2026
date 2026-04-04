#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Deploy hierarchical hiring refactor to Fly.io debate containers.
#
# This ships the new `fly-agent-server.ts` with the `/hire-and-analyze`
# endpoint to vm-alpha / vm-risk / vm-executor, PLUS sets the secrets those
# containers need to autonomously hire specialists via x402:
#   · AGENT_MNEMONIC        — HD wallet seed for signing x402 payments
#   · AGENT_URL_*           — peer URLs for all 10 specialists
#
# Usage:
#   ./fly/deploy-hierarchical.sh                # deploy all 3 debate agents
#   ./fly/deploy-hierarchical.sh alpha          # deploy one
#   SMOKE_ONLY=1 ./fly/deploy-hierarchical.sh   # skip deploy, just smoke test
# ═══════════════════════════════════════════════════════════════════════════
set -e

export PATH="$HOME/.fly/bin:$PATH"

# ── Preflight ───────────────────────────────────────────────────────────────

if ! command -v fly >/dev/null; then
  echo "❌ flyctl not in PATH. Install via \`brew install flyctl\` or set PATH=\$HOME/.fly/bin:\$PATH"
  exit 1
fi

WHOAMI=$(fly auth whoami 2>&1 || true)
if [[ "$WHOAMI" == *"Error"* ]] || [[ -z "$WHOAMI" ]]; then
  echo "❌ Not logged in. Run: fly auth login"
  exit 1
fi
echo "✅ flyctl auth: $WHOAMI"

if [ ! -f .env ]; then
  echo "❌ .env not found — run from repo root"
  exit 1
fi

# Load secrets from local .env (careful: only extract the values we need)
extract_env() {
  grep "^$1=" .env | sed "s|^$1=||" | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'$//"
}

AGENT_MNEMONIC_VAL=$(extract_env AGENT_MNEMONIC)
OG_PRIVATE_KEY_VAL=$(extract_env OG_PRIVATE_KEY)
OG_PROVIDER_ADDRESS_VAL=$(extract_env OG_PROVIDER_ADDRESS)
OG_RPC_URL_VAL=${OG_RPC_URL:-$(extract_env OG_RPC_URL)}
OG_STORAGE_INDEXER_VAL=${OG_STORAGE_INDEXER:-$(extract_env OG_STORAGE_INDEXER)}

if [ -z "$AGENT_MNEMONIC_VAL" ]; then
  echo "❌ AGENT_MNEMONIC not in .env — required for x402 signing"
  exit 1
fi
if [ -z "$OG_PRIVATE_KEY_VAL" ]; then
  echo "❌ OG_PRIVATE_KEY not in .env"
  exit 1
fi

: "${OG_RPC_URL_VAL:=https://evmrpc-testnet.0g.ai}"
: "${OG_STORAGE_INDEXER_VAL:=https://indexer-storage-testnet-turbo.0g.ai}"

echo "✅ secrets loaded from .env"
echo ""

# ── Which agents? ──────────────────────────────────────────────────────────

if [ -n "$1" ]; then
  DEBATE_AGENTS=("$1")
else
  DEBATE_AGENTS=(alpha risk executor)
fi

# ── Helper: set all secrets on one debate container ────────────────────────

set_secrets() {
  local agent=$1
  local app="vm-${agent}"
  echo "── Setting secrets on $app ──"
  fly secrets set \
    AGENT_NAME="${agent}" \
    AGENT_MNEMONIC="${AGENT_MNEMONIC_VAL}" \
    OG_PRIVATE_KEY="${OG_PRIVATE_KEY_VAL}" \
    OG_PROVIDER_ADDRESS="${OG_PROVIDER_ADDRESS_VAL}" \
    OG_RPC_URL="${OG_RPC_URL_VAL}" \
    OG_STORAGE_INDEXER="${OG_STORAGE_INDEXER_VAL}" \
    AGENT_URL_SENTIMENT="https://vm-sentiment.fly.dev" \
    AGENT_URL_WHALE="https://vm-whale.fly.dev" \
    AGENT_URL_MOMENTUM="https://vm-momentum.fly.dev" \
    AGENT_URL_MEMECOIN_HUNTER="https://vm-memecoin-hunter.fly.dev" \
    AGENT_URL_TWITTER_ALPHA="https://vm-twitter-alpha.fly.dev" \
    AGENT_URL_DEFI_YIELD="https://vm-defi-yield.fly.dev" \
    AGENT_URL_NEWS_SCANNER="https://vm-news-scanner.fly.dev" \
    AGENT_URL_ONCHAIN_FORENSICS="https://vm-onchain-forensics.fly.dev" \
    AGENT_URL_OPTIONS_FLOW="https://vm-options-flow.fly.dev" \
    AGENT_URL_MACRO_CORRELATOR="https://vm-macro-correlator.fly.dev" \
    --app "$app" \
    --stage
}

deploy_agent() {
  local agent=$1
  local app="vm-${agent}"
  # Write fly.toml to the repo root so fly resolves `[build].dockerfile` relative
  # to it. Same pattern as deploy-agent.sh — delete on exit even on failure.
  sed "s/FLYAPPNAME/${app}/g; s/FLYAGENTNAME/${agent}/g" fly/fly.toml.template > fly.toml
  trap 'rm -f fly.toml' RETURN
  echo "── Deploying $app ──"
  fly deploy \
    --app "$app" \
    --remote-only \
    --yes
  rm -f fly.toml
  trap - RETURN
}

smoke_test() {
  local agent=$1
  local app="vm-${agent}"
  echo "── Smoke testing https://${app}.fly.dev/hire-and-analyze ──"
  local code
  code=$(curl -sf -m 90 -o /tmp/smoke.json -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"userGoal":"smoke test","riskProfile":"balanced","marketVolatility":"medium","maxTradePercent":10,"userWalletIndex":null}' \
    "https://${app}.fly.dev/hire-and-analyze" || echo "000")

  echo "   HTTP $code"
  if [[ "$code" == "200" ]]; then
    local hired
    hired=$(node -e "const b=require('fs').readFileSync('/tmp/smoke.json','utf8');const j=JSON.parse(b);console.log('specialists_hired:',(j.specialists_hired||[]).length,'cost:$'+(j.total_cost_usd||0).toFixed(4));" 2>/dev/null || echo "   (parse failed)")
    echo "   $hired"
    return 0
  else
    echo "   body: $(head -c 300 /tmp/smoke.json 2>/dev/null)"
    return 1
  fi
}

# ── Execute ─────────────────────────────────────────────────────────────────

if [ "${SMOKE_ONLY:-0}" = "1" ]; then
  echo "=== SMOKE ONLY ==="
  for agent in "${DEBATE_AGENTS[@]}"; do
    smoke_test "$agent" || true
  done
  exit 0
fi

for agent in "${DEBATE_AGENTS[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "  Deploying vm-${agent} with hierarchical hiring support"
  echo "════════════════════════════════════════════════════════════"
  set_secrets "$agent"
  deploy_agent "$agent"
  echo ""
  echo "✅ vm-${agent} deployed"
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Smoke testing all deployed debate agents"
echo "════════════════════════════════════════════════════════════"
FAILED=()
for agent in "${DEBATE_AGENTS[@]}"; do
  if ! smoke_test "$agent"; then
    FAILED+=("$agent")
  fi
done

echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "🎉 ALL DEBATE AGENTS RETURN 200 ON /hire-and-analyze"
  echo ""
  echo "Next step: re-run the E2E validator to prove hierarchical hiring:"
  echo "  ./node_modules/.bin/tsx scripts/validate-display-flow.ts"
else
  echo "⚠️  Smoke test failures: ${FAILED[*]}"
  echo "   Check 'fly logs --app vm-<agent>' for startup errors"
  exit 1
fi
