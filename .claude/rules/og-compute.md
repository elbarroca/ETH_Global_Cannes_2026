---
globs: src/og/**, src/config/og-*.ts
---

# 0G Compute SDK Rules

These patterns are verified against `@0glabs/0g-serving-broker` docs. Do NOT deviate.

## Broker Initialization
```typescript
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';
const broker = await createZGComputeNetworkBroker(wallet);
```

## Mandatory Sequence
1. `broker.inference.depositFund("10")` — STRING, not number
2. `broker.inference.listService()` — get available providers
3. `broker.inference.acknowledgeProviderSigner(provider)` — BEFORE first inference
4. `broker.inference.getRequestHeaders(provider, content, chatID)` — SINGLE-USE headers
5. `fetch(...)` with those headers
6. `broker.inference.processResponse(provider, content, chatID)` — 3 args exactly

## Rules
- Headers are SINGLE-USE. Generate new `getRequestHeaders()` for EVERY request.
- `depositFund()` takes a STRING argument: `"10"` not `10`.
- `processResponse()` takes exactly 3 args: `(provider, content, chatID)`.
- RPC must be exactly: `https://evmrpc-testnet.0g.ai`
- Rate limit: 30 req/min. Add 2s delay between sequential calls.
- JSON from 7B models malforms frequently — ALWAYS wrap `JSON.parse()` in try/catch.
- `signer as any` is the ONLY permitted `any` (ethers v5/v6 mismatch in 0G storage).

## 0G Storage
```typescript
import { ZgFile, getFlowContract } from '@0glabs/0g-ts-sdk';
const flowContract = getFlowContract(flowAddr, signer as any); // ethers v5/v6
```
