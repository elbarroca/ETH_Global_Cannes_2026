# Memory Schema

## Storage Backend
0G Decentralized Storage via `@0gfoundation/0g-ts-sdk`

## Format
Each cycle stores a JSON blob:
```json
{
  "userId": "uuid",
  "data": { ... CompactCycleRecord ... },
  "storedAt": "ISO-8601 timestamp"
}
```

## Retrieval
Memory is indexed by `rootHash` (returned on upload). The iNFT metadata URI points to the latest storage hash: `0g-storage://{rootHash}`.

To load previous cycle memory:
1. Read iNFT metadata URI to get latest `rootHash`
2. Call `loadMemory(rootHash)` to download and parse JSON
3. Extract `data` field for the `CompactCycleRecord`

## Retention
All cycle records are permanent on 0G Storage. There is no TTL or expiration. Historical records can be retrieved if the `rootHash` is known.

## Privacy
Cycle data is stored unencrypted. The `userId` is a UUID (not wallet address). Specialist attestation hashes are truncated to 16 chars in the compact record.
