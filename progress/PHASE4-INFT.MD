# PHASE 4D — iNFT on 0G Chain (ERC-7857)

> **Date:** 2026-04-04 · **Status:** DEPLOYED + 25/25 E2E TESTS PASSED
> **Contract:** `0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874` (0G Testnet)
> **Oracle:** `0x4E8B9a9331CD35E43405a503E34b1fff945a580e` (MockOracle)

---

## WHAT WAS BUILT

Each user's AI agent is minted as an on-chain ERC-7857 iNFT on 0G Chain. The token links proxy wallet → SOUL.md personality → performance history on 0G Storage. Metadata updates on every cycle, creating a living on-chain identity for each agent.

### Contracts

| File | What | Status |
|------|------|--------|
| `contracts/MockOracle.sol` | Stub TEE/ZKP verifier for ERC-7857 transfers (always returns true) | DEPLOYED |
| `contracts/VaultMindAgent.sol` | ERC-7857 iNFT — mint, update, intelligentDataOf, oracle, guards | DEPLOYED |

**Solidity:** `^0.8.24` with `evmVersion: "cancun"` (required by 0G Chain). OpenZeppelin v5.6.1 (`ERC721.sol` needs `^0.8.24`).

### ERC-7857 Features Implemented

| Feature | Implementation | Status |
|---------|---------------|--------|
| `IntelligentData` struct | `intelligentDataOf(tokenId)` returns `[agent_memory, agent_soul]` | LIVE |
| Oracle address | Constructor takes `_oracle`, stored on-chain, queryable via `getOracle()` | LIVE |
| Encrypted metadata hash | `metadataHashes[tokenId]` — keccak256 of 0G Storage rootHash | LIVE |
| Encrypted storage URI | `encryptedURIs[tokenId]` — `"0g-storage://{rootHash}"` pointer | LIVE |
| Dynamic updates | `updateMetadata()` increments `cycleCount` per call | LIVE |
| Agent wallet binding | `agentWallets[tokenId]` + `walletToToken[wallet]` reverse lookup | LIVE |
| Soul fingerprint | `soulHashes[tokenId]` — keccak256 of SOUL.md content | LIVE |
| Risk profile | `riskProfiles[tokenId]` — on-chain risk preference | LIVE |
| Duplicate guard | `require(walletToToken[agentWallet] == 0)` — one iNFT per proxy wallet | LIVE |

**Simplified for hackathon:** Oracle verification stubbed (MockOracle). Transfer re-encryption, `clone()`, `authorizeUsage()` deferred.

### Scripts

| File | What | Status |
|------|------|--------|
| `scripts/deploy-inft.ts` | Deploys MockOracle + VaultMindAgent using ethers v6 + compiled artifacts | VALIDATED |
| `scripts/test-inft.ts` | 25-test E2E suite — mint, read, update ×3, risk, guards, ERC-7857 spec | 25/25 PASS |

### TypeScript Wrapper

| File | Exports | Status |
|------|---------|--------|
| `src/og/inft.ts` | `mintAgentNFT()`, `updateAgentMetadata()`, `updateAgentRiskProfile()`, `getAgentInfo()`, `getIntelligentData()`, `getAgentByWallet()` | VALIDATED |

### Wiring

| Where | What | Status |
|-------|------|--------|
| `src/types/index.ts` | Added `inftTokenId: number \| null` to `UserRecord` | DONE |
| `src/store/user-store.ts` | Added `inftTokenId` to `UserPatch` + `createUser` default + `updateUser` merge | DONE |
| `src/api/routes/onboard.ts` | POST `/api/onboard` → mints iNFT after user creation (non-fatal) | DONE |
| `src/agents/main-agent.ts` | After 0G storage write → `updateAgentMetadata(tokenId, rootHash)` (non-fatal) | DONE |

---

## E2E TEST RESULTS (25/25)

```
═══════════════════════════════════════════════
  iNFT E2E TEST — VaultMindAgent on 0G Chain
═══════════════════════════════════════════════
  Contract: 0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874

TEST 1: Contract state
  ✅ Oracle address matches .env

TEST 2: Mint agent
  ✅ Mint transaction succeeded
  ✅ Token minted with ID 1
  → tx: 0xf63f641da40fdd46e13836b1938e6f9271c0c5ba95e20e4ba79c9d213a8cf937

TEST 3: Read agent data
  ✅ Owner matches test user
  ✅ Agent wallet matches proxy
  ✅ Metadata hash matches
  ✅ Encrypted URI is genesis
  ✅ Soul hash matches
  ✅ Risk profile is balanced
  ✅ Cycle count starts at 0

TEST 4: Reverse lookup
  ✅ walletToToken(proxy) = 1

TEST 5: IntelligentData (ERC-7857)
  ✅ Returns 2 IntelligentData entries
  ✅ First = agent_memory
  ✅ Memory hash matches metadata
  ✅ Second = agent_soul
  ✅ Soul hash matches

TEST 6: Metadata updates (3 cycles)
  ✅ Cycle 1 update tx succeeded
  ✅ Cycle 2 update tx succeeded
  ✅ Cycle 3 update tx succeeded
  ✅ Cycle count = 3
  ✅ URI points to latest cycle

TEST 7: Risk profile change
  ✅ Risk update tx succeeded
  ✅ Risk changed to aggressive

TEST 8: Duplicate wallet guard
  ✅ Duplicate proxy wallet correctly rejected

TEST 9: Invalid token guard
  ✅ Nonexistent token correctly reverts

═══════════════════════════════════════════════
  RESULTS: ✅ 25 passed · ❌ 0 failed
═══════════════════════════════════════════════
```

---

## FULL PHASE 4 STATUS

| Phase | What | Tests | Status |
|-------|------|-------|--------|
| **4A** | HTS Fund Token — mint, burn, grantKyc, freeze, unfreeze, getTokenInfo, getBalance | 3/3 | LIVE on Hedera testnet |
| **4B** | 0G Storage — storeMemory, loadMemory (SDK upgraded `@0glabs` → `@0gfoundation/0g-ts-sdk@1.2.1`) | 2/2 | LIVE on 0G testnet |
| **4C** | Hedera Scheduled Transactions — ScheduleCreate + ScheduleSign for private topic | 1/1 | LIVE on Hedera testnet |
| **4D** | iNFT on 0G Chain — ERC-7857, mint, update, intelligentDataOf, oracle, guards | 25/25 | LIVE on 0G testnet |
| **Wiring** | fund.ts (HTS), main-agent.ts (0G storage + iNFT), onboard.ts (iNFT mint) | — | DONE |
| **Total** | | **36/36** | ALL PASS |

---

## LIVE CONTRACTS + ON-CHAIN IDs

| Asset | Address / ID | Network | Explorer |
|-------|-------------|---------|----------|
| VaultMindAgent (iNFT) | `0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874` | 0G Chain (16602) | chainscan-newton.0g.ai |
| MockOracle | `0x4E8B9a9331CD35E43405a503E34b1fff945a580e` | 0G Chain (16602) | chainscan-newton.0g.ai |
| HTS Fund Token (VMF) | `0.0.8498202` | Hedera testnet | hashscan.io |
| HCS Audit Topic | `0.0.8497439` | Hedera testnet | hashscan.io |
| Scheduled Heartbeat | `0.0.8500188` | Hedera testnet | hashscan.io |

---

## FILES CREATED/MODIFIED IN PHASE 4

### New Files (12)
```
contracts/
  MockOracle.sol                ← ERC-7857 oracle stub
  VaultMindAgent.sol            ← iNFT contract (ERC-721 + ERC-7857)
scripts/
  setup-token.ts                ← HTS token creation
  deploy-inft.ts                ← Deploy iNFT to 0G Chain
  test-inft.ts                  ← 25-test E2E iNFT validation
  test-phase4.ts                ← 11-test Phase 4A-C validation
src/hedera/
  hts.ts                        ← HTS lifecycle (7 functions)
  scheduler.ts                  ← Scheduled heartbeat
src/config/
  og-storage.ts                 ← 0G storage config (lazy singleton)
src/og/
  storage.ts                    ← storeMemory / loadMemory
  inft.ts                       ← iNFT wrapper (6 functions)
hardhat.config.cjs              ← Hardhat 2 config for 0G testnet
```

### Modified Files (5)
```
package.json                    ← +@0gfoundation/0g-ts-sdk, +hardhat, +OZ, -@0glabs/0g-ts-sdk
src/types/index.ts              ← +inftTokenId field
src/store/user-store.ts         ← +inftTokenId in UserPatch, createUser, updateUser
src/api/routes/fund.ts          ← Deposit mints HTS, withdraw burns HTS
src/api/routes/onboard.ts       ← Mints iNFT on user creation
src/agents/main-agent.ts        ← +0G storage + iNFT metadata update after cycle
```

---

## BOUNTY IMPACT

| Bounty | Before Phase 4 | After Phase 4 | Delta |
|--------|---------------|---------------|-------|
| 0G DeFi ($5K) | 70% | **95%** | +Storage + iNFT |
| 0G OpenClaw ($7K) | 0% | **40%** | +iNFT (needs OpenClaw workspaces) |
| Hedera AI ($5K) | 75% | **95%** | +HTS + Scheduled Tx |
| No Solidity ($2K) | 80% | **95%** | +HTS (zero Solidity on Hedera) |
| Tokenization ($2.5K) | 0% | **90%** | +HTS mint/burn + custom fees |

---

## HOW TO VALIDATE

```bash
# Compile contracts
./node_modules/.bin/hardhat compile

# Deploy (if needed — already deployed)
./node_modules/.bin/tsx scripts/deploy-inft.ts

# iNFT E2E (25 tests)
./node_modules/.bin/tsx scripts/test-inft.ts

# Phase 4A-C (HTS + Storage + Scheduler)
./node_modules/.bin/tsx scripts/test-phase4.ts --write

# TypeScript check
npx tsc --noEmit
```

---

## KEY DECISIONS

1. **Solidity 0.8.24** — OZ v5.6.1 requires `^0.8.24` minimum (`ERC721.sol`, `Strings.sol`, `Bytes.sol`). The 0G docs suggest 0.8.19 but that's for projects without OZ v5. Validated: 0.8.19 fails to compile, 0.8.24 compiles + deploys + runs.

2. **Hardhat 2 (not 3)** — Hardhat 3.3.0 has breaking changes (no side-effect plugin imports, no `hre.ethers`, `@nomicfoundation/hardhat-toolbox` v7 is a tombstone). Hardhat 2.28.6 + toolbox v5 works with ESM via `.cjs` config.

3. **0G SDK upgrade** — `@0glabs/0g-ts-sdk@0.3.3` → `@0gfoundation/0g-ts-sdk@1.2.1`. Old SDK's `submit()` selector `0xef3e12dc` doesn't exist in the upgraded 0G testnet flow contract (beacon proxy at `0x22E03a...` points to new impl `0xF99cccc...` with different `Submission` struct including `submitter` field).

4. **Non-fatal wiring** — iNFT mint in onboarding and metadata update in cycle are wrapped in try/catch. The cycle never fails because of iNFT issues.
