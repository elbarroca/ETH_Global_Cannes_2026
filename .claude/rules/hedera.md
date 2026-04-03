---
globs: src/hedera/**, src/config/hedera.ts, scripts/setup-topic.ts, scripts/setup-token.ts
---

# Hedera SDK Rules

These patterns are verified against `@hashgraph/sdk` ^2.69.0 docs. Do NOT deviate.

## Client
```typescript
const client = Client.forTestnet().setOperator(
  AccountId.fromString(process.env.OPERATOR_ID!),
  PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!)
);
```

## Rules
- **freeze → sign → execute** on EVERY transaction with a submit/admin key:
  ```typescript
  const tx = await new SomeTransaction()
    .setWhatever(...)
    .freezeWith(client)
    .sign(operatorKey);
  await tx.execute(client);
  ```
- **6-second mirror node delay** after writes before reads:
  ```typescript
  await new Promise(r => setTimeout(r, 6000));
  ```
- **ZERO Solidity.** No .sol files. No ContractExecuteTransaction. No EVM on Hedera.
  This project targets the "No Solidity" bounty.
- HCS messages are base64-encoded in Mirror Node responses — decode with `Buffer.from(msg, 'base64').toString()`.
- Mirror Node API: `https://testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages`
- Use `PrivateKey.fromStringED25519()` for ED25519 keys (not `fromString()`).
