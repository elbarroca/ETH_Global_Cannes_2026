---
description: Test the full VaultMind investment cycle end-to-end
allowed-tools: Read, Bash, Grep, Glob
---

# Test Full Cycle

Run the VaultMind testing flow step by step, validating each integration independently before testing the full cycle.

## Testing Sequence

### Step 1: Hedera HCS
```bash
npx ts-node scripts/setup-topic.ts
```
- Verify: Topic ID appears in output
- Verify: Topic visible on Hashscan testnet

### Step 2: Hedera HTS
```bash
npx ts-node scripts/setup-token.ts
```
- Verify: Token ID appears in output
- Verify: Token visible on Hashscan testnet

### Step 3: 0G Broker Setup
```bash
npx ts-node scripts/setup-og-account.ts
```
- Verify: Broker funded message
- Verify: `listService()` returns available models

### Step 4: 0G Inference
```bash
npx ts-node src/og/test-inference.ts
```
- Verify: Inference response received
- Verify: Attestation hash captured

### Step 5: Specialist Servers
```bash
npx ts-node src/agents/specialist-server.ts &
sleep 2
curl -s -o /dev/null -w "%{http_code}" localhost:4001/analyze
curl -s -o /dev/null -w "%{http_code}" localhost:4002/analyze
curl -s -o /dev/null -w "%{http_code}" localhost:4003/analyze
```
- Verify: All return HTTP 402 (payment required)

### Step 6: Full Cycle
```bash
npx ts-node src/index.ts
```
- Verify: Specialists hired (x402 payments)
- Verify: Debate completed (0G inference)
- Verify: Decision logged to HCS
- Verify: Telegram notification sent
- Verify: Dashboard updated

## Reporting
After each step, report:
- **PASS** — expected output received
- **FAIL** — what went wrong + suggested fix from ERROR→FIX table in CLAUDE.md
- **SKIP** — dependency not yet built

Stop at first FAIL and suggest the fix before continuing.
