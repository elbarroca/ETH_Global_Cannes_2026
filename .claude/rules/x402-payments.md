---
globs: src/payments/**, src/config/arc.ts
---

# x402 Payment SDK Rules

These patterns are verified against `@x402/fetch`, `@x402/express`, `@x402/evm` docs. Do NOT deviate.

## Buyer (Main Agent)
```typescript
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from '@x402/fetch';

const account = privateKeyToAccount(key as `0x${string}`);
const payFetch = wrapFetchWithPayment(fetch, walletClient);
```

## Seller (Specialist)
```typescript
import { paymentMiddleware } from '@x402/express';
import { evmPaymentVerifier } from '@x402/evm';

app.use(paymentMiddleware(evmPaymentVerifier, routeConfig, options));
```

## Rules
- Buyer signing MUST use `viem/accounts` — NEVER ethers for payment signing.
- Route config format: `"GET /analyze"` (method SPACE path) — NOT `"/analyze"`.
- `wrapFetchWithPayment()` handles the full 402 negotiate-pay-retry flow automatically.
- Facilitator URL: `https://x402.org/facilitator`
- Network: `base-sepolia` for testnet.
- Price format: string like `"0.001"`.
