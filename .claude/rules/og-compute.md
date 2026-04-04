---
globs: src/og/**, src/config/og-*.ts
---

# 0G SDK Rules

Patterns verified against installed `@0glabs/0g-serving-broker` v0.7.4 `.d.ts` files and `@0gfoundation/0g-ts-sdk` v1.2.1. Do NOT deviate.

## Broker Initialization
```typescript
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
const broker = await createZGComputeNetworkBroker(wallet);
```

## Mandatory Sequence
1. `broker.inference.depositFund(10)` — NUMBER, not string
2. `broker.inference.listService()` — get available providers
3. `broker.inference.getRequestHeaders(provider)` — 1 arg (2nd is @deprecated). SINGLE-USE.
4. `fetch(...)` with those headers
5. `broker.inference.processResponse(provider, chatID, usageJSON)` — 3 args: provider address, chatID from `ZG-Res-Key` header, `JSON.stringify(data.usage)` for fee caching

## Rules
- Headers are SINGLE-USE. Generate new `getRequestHeaders()` for EVERY request.
- `depositFund()` takes a NUMBER: `10` not `"10"`.
- `getRequestHeaders()` takes 1 arg: `(provider)`. The 2nd arg `_content` is `@deprecated`.
- `processResponse()` takes 3 args: `(provider, chatID, usageJSON)`. 3rd arg is `JSON.stringify(data.usage ?? {})` (fee caching), NOT response text.
- `acknowledgeProviderSigner()` exists but is NOT required — tests pass without it.
- RPC must be exactly: `https://evmrpc-testnet.0g.ai`
- Rate limit: 30 req/min. Add 2s delay between sequential calls.
- JSON from 7B models malforms frequently — ALWAYS wrap `JSON.parse()` in try/catch.
- `signer as any` is the ONLY permitted `any` (ethers v5/v6 mismatch in 0G storage).

## 0G Storage
```typescript
import { Indexer } from '@0gfoundation/0g-ts-sdk';
// NOTE: package is @0gfoundation (NOT @0glabs)
const indexer = new Indexer(indexerUrl);
```

## iNFT (ERC-7857 on 0G Chain)
- Contract: `VaultMindAgent.sol` on 0G Chain (chainId 16602)
- Uses ethers v6 (NOT viem) — 0G Chain requires ethers provider
- `mintAgentNFT()`, `updateAgentMetadata()`, `getAgentInfo()`, `getIntelligentData()`
- All iNFT operations are NON-FATAL — cycle never fails because of iNFT issues
