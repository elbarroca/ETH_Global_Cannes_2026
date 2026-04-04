# Investment Cycle Procedure

## Pre-conditions
- User is active (`agent.active = true`)
- User has deposited funds (`fund.depositedUsdc > 0`)
- Risk profile and max trade percent are set

## Cycle Steps

### Step 1: Hire Specialists
Pay $0.001 each via x402 to three specialists:
1. **Sentiment Analyst** (port 4001) — social media sentiment
2. **Whale Tracker** (port 4002) — large wallet flows
3. **Momentum Analyst** (port 4003) — technical indicators

Each returns: `{signal, confidence, attestationHash, teeVerified}`

If all three fail, use fallback mock signals (2x BUY + 1x HOLD) and continue.

### Step 2: Adversarial Debate
Run three sealed inferences on 0G Compute (2s delay between each):

1. **Alpha** — Argues FOR the trade. Sees specialist signals + risk profile.
2. **Risk** — Argues AGAINST. Sees specialist signals + Alpha's proposal.
3. **Executor** — Makes final call. Sees both Alpha and Risk arguments.

Each stage returns JSON with TEE attestation.

### Step 3: On-Chain Logging
1. Build compact record (under 1024 bytes)
2. Submit to Hedera HCS topic (freeze → sign → execute)
3. Record sequence number and Hashscan URL

### Step 4: Decentralized Storage
1. Upload full cycle record to 0G Storage (non-fatal)
2. If iNFT exists, update metadata with storage root hash (non-fatal)

### Step 5: Database Persistence
1. Log incremental actions throughout the cycle (CYCLE_STARTED, SPECIALIST_HIRED x3, DEBATE_ALPHA, DEBATE_RISK, DEBATE_EXECUTOR, HCS_LOGGED, STORAGE_UPLOADED, INFT_UPDATED, CYCLE_COMPLETED)
2. Save full cycle record via `logCycleRecord()` (specialists, debate, decision, proofs)
3. Update user: increment `lastCycleId`, set `lastCycleAt`

### Step 6: Notify
Heartbeat calls `notifyUser(user, result)` synchronously after `runCycle()` returns.

## Post-conditions
- HCS has immutable record with sequence number
- 0G Storage has full cycle data (if upload succeeded)
- iNFT metadata updated (if token exists)
- User record updated with latest cycle info
