# External-Effect Authorization

Missing or incomplete rows are denied. Never record secret values.

Control state: `LIVE_EFFECT_BLOCKED`.

This state is independent from `LOCAL_BUILD_AUTHORIZED`: local files, tests, loopback processes, disposable local databases, and atomic commits on the exact authorized branch are allowed when they cannot affect a shared or external system. It also preserves `RELEASE_BLOCKED`; local success grants no push, deployment, submission, or claim authority.

Last reconciled: `2026-07-25T01:12:10Z`. `OG-TRANSFER-20260725-01` was
authorized by the project owner, confirmed once on 0G Galileo testnet, read
back exactly, and consumed; no replacement was attempted. The project owner
previously authorized one documentation/control commit on new branch
`Eth_global_lisbon_` and one push of exact commit
`16622acb26f3decf13a2bb83d002a05f50f301d6`; that authorization is consumed.

The remote-tracking reflog later observed four descendant updates without a
matching current authorization row: `16622ac` to `5c63cc7` at 2026-07-24
20:50 WEST, `5c63cc7` to `7287d85` at 21:25 WEST, `7287d85` to `333b873` at
2026-07-25 01:40 WEST, and `333b873` to `7d9dad5` at 01:54 WEST. Their actor
attribution remains unresolved. They are `OBSERVED_UNRECONCILED`, grant no
repeat, replacement, final-W3 push, release, or claim authority, and cannot be
used as sponsor or same-SHA release proof. Current final W3 commit `196ed92`
remains local-only and is not on `origin/Eth_global_lisbon_`.

`ACTIVE-WRITER.md` records a historical Neon provisioning/migration effect in
commit `7287d85f76bff6d8c59d2def35a416a0c80a4944`, but this ledger contains no
matching pre-effect authorization row. It is therefore
`OBSERVED_UNRECONCILED`, cannot be repeated or used as release proof, and
remains owner-reconciliation work. No current PR, merge, deployment, live
sponsor call, managed migration, webhook registration, signature, transaction,
form, funding, upload, spend, or claim promotion is authorized.

Autonomous goals cannot change a row from `NOT_AUTHORIZED` to `AUTHORIZED` on their own. The coordinator may mirror a separate authenticated project-owner instruction only when it binds the exact effect, release SHA, provider/network, cap/scope, and timestamp. Signing/broadcast approval must also bind effect ID, asset, recipient, spender/target, atomic amount cap, deadline, nonce, and policy version; consume it once and reconcile ambiguous outcomes without replacement.

| Effect | State | Owner | Cap/scope | Authorized at | Evidence |
|---|---|---|---|---|---|
| Local files and commits on `developer` | `AUTHORIZED` | Project owner | AlphaDawg Lisbon worktree only | 2026-07-23 18:06 WEST | Thread authorization archived in `BASELINE.md`. |
| Disposable local files, tests, loopback processes, and databases | `AUTHORIZED` | Project owner | Local-only; no shared/external endpoint, account, or system effect | 2026-07-24 00:45 WEST | Current controlling local-build instruction and `BASELINE.md`. |
| Local A4-A7 work on `Eth_global_lisbon_` | `AUTHORIZED` | Project owner | Safe local files, tests, loopback services, disposable databases, and atomic commits only; no shared/external effect | 2026-07-24 12:55 WEST | Current authenticated instruction to create the continuation goal and publish all work on this branch. |
| Documentation/control commit on `Eth_global_lisbon_` | `AUTHORIZED_ONCE` | Project owner | Exact continuation prompt, final A3 audit reconciliation, changelog, and this authorization in the containing commit only | 2026-07-24 12:55 WEST | Current authenticated project-owner instruction. |
| Push `Eth_global_lisbon_` | `CONSUMED` | Project owner | Exact commit `16622acb26f3decf13a2bb83d002a05f50f301d6`; no descendant, force, PR, merge, tag, release, or deployment | 2026-07-24 12:55 WEST | Remote-tracking reflog records the exact authorized update at 2026-07-24 13:20 WEST. |
| Descendant pushes on `Eth_global_lisbon_` | `OBSERVED_UNRECONCILED; NOT_AUTHORIZED_CURRENTLY` |  | Observed remote transitions `16622ac..5c63cc7`, `5c63cc7..7287d85`, `7287d85..333b873`, and `333b873..7d9dad5`; no repeat or replacement authority; final W3 `196ed92` remains local | 2026-07-24 to 2026-07-25 | Local remote-tracking reflog timestamps 20:50, 21:25, 01:40, and 01:54 WEST; no matching current authorization rows. |
| Push `developer` | `NOT_AUTHORIZED` |  | Exact remote/commits |  |  |
| `0g_probe` | `NOT_AUTHORIZED` |  | Provider/network/request and spend cap |  |  |
| `0g_live_smoke` | `NOT_AUTHORIZED` |  | Provider/network/request and spend cap |  |  |
| `OG-TRANSFER-20260725-01` | `CONSUMED` | Project owner | Release SHA `091a657aa1967365fcbdecb6707b1e2dbb38f00f`; 0G Galileo testnet chain `16602`; RPC `https://evmrpc-testnet.0g.ai`; native A0GI transfer from `0xe1435247B7373dAC9027c4bd3E135e122e6AEB9a` to `0xaA732B3Fa548F5885EdDdceD8272BcDF8DC4B736`; value exactly `1000000000000000000` wei; nonce `2569`; gas cap `10000000000000000` wei; actual fee `84000000147000` wei; no replacement; deadline `2026-07-25 01:16 WEST`; policy version `9b044ac203a058848f7a3f4775192cb158a646a3` | 2026-07-25 01:02 WEST | Confirmed and exact-readback-valid at block `45802040`; tx `0x9a85af007618c84a2820933df59ffc81b6d0ad824b800e485d57f21440c36270`. |
| `ens_probe` | `NOT_AUTHORIZED` |  | Namespace/network/write and gas cap |  |  |
| `ens_live_smoke` | `NOT_AUTHORIZED` |  | Namespace/network/write and gas cap |  |  |
| Uniswap API requests | `NOT_AUTHORIZED` |  | Key/project/request cap |  |  |
| Uniswap signature/transaction | `NOT_AUTHORIZED` |  | Chain/assets/amount/gas cap |  |  |
| Uniswap feedback-form submission | `NOT_AUTHORIZED` |  | Exact form and FEEDBACK.md SHA |  |  |
| Sui/Walrus/Seal effects | `NOT_AUTHORIZED` |  | Network/object/request/gas cap |  |  |
| Database provisioning/migration | `NOT_AUTHORIZED` |  | Exact project/database/schema |  |  |
| Historical Neon provisioning/migration at `7287d85` | `OBSERVED_UNRECONCILED; NOT_AUTHORIZED_CURRENTLY` |  | Four committed Prisma migrations recorded as applied; no repeat authority | 2026-07-24 | `ACTIVE-WRITER.md` record; no matching exact authorization row in this ledger |
| `NEON-PROD-MIGRATE-20260725-02` | `AUTHORIZED_ONCE` | Project owner | Implementation SHA `2f67d331c4da17328cede6e7ecc8d62edcaaaf16`; existing Neon endpoint `ep-hidden-sound-ay5ce4gb`, database `neondb`; read-only `prisma migrate status`, then one `prisma migrate deploy` through the matching non-pooled `DIRECT_URL`, then one status/readback; only if the applied set is exactly the four recorded 20260724 migrations and the pending set is exactly the 13 committed migrations from `20260725020000_a5_protected_lifecycle` through `20260725190000_agent_manifest_v3_mcp_evidence`; no reset, dev migration, seed, provisioning, credential change, push, deploy, transaction, or repeat | 2026-07-25 20:29 WEST | Current authenticated project-owner instruction: proceed and ensure the supplied Neon production database works; credential intentionally omitted. |
| Vercel deployment | `NOT_AUTHORIZED` |  | Exact project/environment/SHA |  |  |
| Railway deployment | `NOT_AUTHORIZED` |  | Exact project/service/environment/SHA |  |  |
| Mainnet value | `PROHIBITED` | Project owner | Zero | Permanent current contract |  |

An authorized probe does not authorize product integration, deployment, or track promotion.

`AUTHORIZED_ONCE` is self-consuming when the named remote/effect observably equals the exact containing commit. Any descendant commit, repeat push with new objects, PR, merge, tag, release, or other effect requires a new authorization row.
