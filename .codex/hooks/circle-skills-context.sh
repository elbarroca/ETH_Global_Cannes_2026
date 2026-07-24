#!/usr/bin/env bash

set -u

EVENT="${1:-UserPromptSubmit}"
PROJECT="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$PWD")"
SKILLS_DIR="${CIRCLE_SKILLS_DIR:-$PROJECT/.agents/skills}"
SOURCE_COMMIT="c7d269a2025e26410e0e23fb5a73c769dc07d088"
SKILLS=(
  accept-agent-payments
  agent-wallet-policy
  bridge-stablecoin
  fund-agent-wallet
  pay-via-agent-wallet
  swap-tokens
  unify-balance
  use-agent-wallet
  use-arc
  use-circle-cli
  use-circle-wallets
  use-developer-controlled-wallets
  use-gateway
  use-modular-wallets
  use-smart-contract-platform
  use-usdc
  use-user-controlled-wallets
)

if [ "$EVENT" = "UserPromptSubmit" ]; then
  PAYLOAD="$(cat 2>/dev/null || true)"
  if ! printf '%s' "$PAYLOAD" | grep -Eiq \
    'circle|usdc|stablecoin|arc([ _-]?testnet)?|x402|gateway|wallet|faucet|sepolia|smart contract|deploy|transaction|payment|bridge'; then
    exit 0
  fi
fi

MISSING=""
for skill in "${SKILLS[@]}"; do
  if [ ! -f "$SKILLS_DIR/$skill/SKILL.md" ]; then
    MISSING="${MISSING}${MISSING:+, }$skill"
  fi
done

ENV_MISSING=""
for key in CIRCLE_API_KEY CIRCLE_ENTITY_SECRET CIRCLE_WALLET_SET_ID DATABASE_URL; do
  found=0
  if [ -n "$(printenv "$key" 2>/dev/null || true)" ]; then
    found=1
  fi
  for env_file in "$PROJECT/.env" "$PROJECT/.env.local" "$PROJECT/.env.development.local"; do
    if [ -f "$env_file" ] && grep -Eq "^${key}=.+" "$env_file"; then
      found=1
      break
    fi
  done
  if [ "$found" -eq 0 ]; then
    ENV_MISSING="${ENV_MISSING}${ENV_MISSING:+, }$key"
  fi
done

python3 - "$EVENT" "$MISSING" "$SOURCE_COMMIT" "$ENV_MISSING" <<'PY'
import json
import sys

event, missing, source_commit, env_missing = sys.argv[1:5]
status = (
    f"Missing project Circle skills: {missing}. Restore them before relying on Circle guidance."
    if missing
    else f"All 17 project Circle skills validated at source commit {source_commit}."
)
local_status = (
    f"Local Circle/UI E2E is not ready; missing configured variables: {env_missing}."
    if env_missing
    else "Required local Circle and database variables are configured by name; values were not read or emitted."
)
context = f"""<circle-project-context>
{status}
{local_status}
Before Circle, USDC, Arc, wallet, x402, Gateway, transaction, or contract work, read the matching .agents/skills/<name>/SKILL.md completely. Route wallet selection through use-circle-wallets; runtime MPC work through use-developer-controlled-wallets; transfers through use-usdc; Arc work through use-arc; contracts/deployments through use-smart-contract-platform; CLI wallet work through use-circle-cli/use-agent-wallet/fund-agent-wallet; x402 work through accept-agent-payments/pay-via-agent-wallet/use-gateway.
Wallet map: the UI agent wallet and direct faucet target is the authenticated user's non-empty user.proxyWallet.address, a Circle developer-controlled MPC wallet on Arc Testnet (chain 5042002), visible at /deposit. The connected browser wallet funds it. hotWalletAddress is the x402 buyer signer. A Circle CLI agent wallet is tooling-only unless the runtime is explicitly changed to use it. If /deposit has no proxy address, stop at BLOCKED_NO_UI_AGENT_WALLET and repair provisioning; never substitute another wallet silently.
Funding rule: for the current UI, request Arc Testnet USDC from https://faucet.circle.com to the displayed proxyWallet.address. Sepolia assets stay on Sepolia and do not fund the Arc UI; use bridge-stablecoin only for an intentional supported CCTP route.
Default to testnet. Circle entity-secret registration is owner-run; agents must not generate, register, print, or store it on the owner's behalf. Before any faucet request, transaction, contract write, or deployment, verify the exact network, public address, asset, amount, and current authorization. Never print or commit API keys, entity secrets, mnemonics, private keys, or recovery files.
E2E gate: /deposit shows the same proxy address -> Arc faucet funds that address -> Arc RPC balance changes -> the UI shows the balance -> a minimal approved action returns a real transaction identifier -> verify it on ArcScan. Do not call simulated IDs or UI-only accounting end-to-end proof.
</circle-project-context>"""
print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": context}}))
PY
