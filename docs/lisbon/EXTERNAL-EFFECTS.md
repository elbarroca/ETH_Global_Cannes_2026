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
| `GRAPH-JUDGE-0G-20260725-01` | `NOT_AUTHORIZED` |  | Exact frozen SHA; 0G Galileo chain `16602`; one bounded Compute request, one proof-enabled Storage upload/readback, exact provider/model/signer, maximum atomic spend, deadline, and buyer/job/version tuple |  | Required before the judge-flow 0G call; iNFT provenance is not 0G proof. |
| `OG-TRANSFER-20260725-01` | `CONSUMED` | Project owner | Release SHA `091a657aa1967365fcbdecb6707b1e2dbb38f00f`; 0G Galileo testnet chain `16602`; RPC `https://evmrpc-testnet.0g.ai`; native A0GI transfer from `0xe1435247B7373dAC9027c4bd3E135e122e6AEB9a` to `0xaA732B3Fa548F5885EdDdceD8272BcDF8DC4B736`; value exactly `1000000000000000000` wei; nonce `2569`; gas cap `10000000000000000` wei; actual fee `84000000147000` wei; no replacement; deadline `2026-07-25 01:16 WEST`; policy version `9b044ac203a058848f7a3f4775192cb158a646a3` | 2026-07-25 01:02 WEST | Confirmed and exact-readback-valid at block `45802040`; tx `0x9a85af007618c84a2820933df59ffc81b6d0ad824b800e485d57f21440c36270`. |
| `ens_probe` | `NOT_AUTHORIZED` |  | Namespace/network/write and gas cap |  |  |
| `ens_live_smoke` | `NOT_AUTHORIZED` |  | Namespace/network/write and gas cap |  |  |
| `GRAPH-JUDGE-ENS-PUBLISH-20260725-01` | `NOT_AUTHORIZED` |  | Exact frozen SHA; creator wallet, buyer wallet, ENS parent, deterministic subname, chain, contract, method, value/gas cap, and one publication/version tuple |  | Required before any signature, iNFT/ENS write, or testnet receipt. |
| `THE-GRAPH-SECRET-CONFIG-20260725-01` | `NOT_AUTHORIZED` |  | Exact deployment target; set server-only `THE_GRAPH_API_KEY` once; no plaintext readback/logging/client exposure; key restrictions and spend/query cap required |  | Configured state alone is not live proof. |
| `THE-GRAPH-LIVE-QUERY-20260725-01` | `NOT_AUTHORIZED` |  | Exact frozen SHA; POST bearer request to fixed primary Subgraph `8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD`, fallback `AXJd5my1nV3MMeoX2FPoxnE7hqqDHiSYEazARyd4xLMj` at most once; two allowlisted operations; 8-second timeout and 32 KiB cap; exact query count/deadline |  | Required before live preflight or replay; no arbitrary endpoint, ID, or GraphQL. |
| Uniswap API requests | `NOT_AUTHORIZED` |  | Key/project/request cap |  |  |
| Uniswap signature/transaction | `NOT_AUTHORIZED` |  | Chain/assets/amount/gas cap |  |  |
| Uniswap feedback-form submission | `NOT_AUTHORIZED` |  | Exact form and FEEDBACK.md SHA |  |  |
| Sui/Walrus/Seal effects | `NOT_AUTHORIZED` |  | Network/object/request/gas cap |  |  |
| Database provisioning/migration | `NOT_AUTHORIZED` |  | Exact project/database/schema |  |  |
| `NEON-WALLET-AUTHORITY-MIGRATE-20260726-01` | `AUTHORIZED_ONCE` | Project owner | Implementation SHA `86150aebb9c3321a2e4fc57186dbcc8e08a3d9df`; existing Neon endpoint `ep-hidden-sound-ay5ce4gb`, database `neondb`; read-only `prisma migrate status`, then one `prisma migrate deploy` through the matching non-pooled `DIRECT_URL`, then one status/schema readback; proceed only when Prisma finds exactly 22 committed migrations and the pending set is exactly `20260725230000_mcp_hire_claim_replay` and `20260725240000_wallet_authority_publication`; no reset, development migration, seed, provisioning, credential change, push, deploy, transaction, or repeat | 2026-07-26 02:09 WEST; narrowed 02:12 WEST | Current authenticated project-owner request to proceed after confirming credential rotation, followed by the explicit instruction to use the Neon skill after the read-only status found exactly those two pending migrations; the original five-migration condition was not met and caused zero migration writes. Secret omitted. |
| Historical Neon provisioning/migration at `7287d85` | `OBSERVED_UNRECONCILED; NOT_AUTHORIZED_CURRENTLY` |  | Four committed Prisma migrations recorded as applied; no repeat authority | 2026-07-24 | `ACTIVE-WRITER.md` record; no matching exact authorization row in this ledger |
| `NEON-PROD-MIGRATE-20260725-02` | `CONSUMED` | Project owner | Implementation SHA `2f67d331c4da17328cede6e7ecc8d62edcaaaf16`; existing Neon endpoint `ep-hidden-sound-ay5ce4gb`, database `neondb`; read-only `prisma migrate status`, then one `prisma migrate deploy` through the matching non-pooled `DIRECT_URL`, then one status/readback; only if the applied set is exactly the four recorded 20260724 migrations and the pending set is exactly the 13 committed migrations from `20260725020000_a5_protected_lifecycle` through `20260725190000_agent_manifest_v3_mcp_evidence`; no reset, dev migration, seed, provisioning, credential change, push, deploy, transaction, or repeat | 2026-07-25 20:29 WEST | Consumed once at 20:31-20:34 WEST: exact pending set matched; 13 migrations applied; post-status 17/17, zero incomplete; required tables/columns and pooled service reads passed; credential omitted. |
| `GITHUB-BRANCH-CLEANUP-20260725-01` | `CONSUMED` | Project owner | Repository `elbarroca/ETH_Global_Cannes_2026`; required remote `Eth_global_lisbon_` at `00147dd019ccd1c50b5de6b4cc8288a365c51c5f`; preserve `f87867a10ae18317c65910b3333f45d3b11f09a8` as lightweight remote tag `archive/flyio-new-files-20260725`; change GitHub default from `main` to `Eth_global_lisbon_`; delete only remote branches `main` at `bfa7bd37c573e2e49525d965f7f937210e170d72`, `feat/agent-voice-debate-rewrite` at `97b7319e611a4709eaa126f122ec0ba30f1e838e`, `feat/new-theme` at `41982b99bcc29b45e7cbd10f75442773908a06a9`, `feat/openclaw-gateway-migration` at `96127038dd3c0dd48be7e935225ab427b0049fbc`, `feat/sprint-b` at `ed7ca4db71b387153a74f50166fe56da4e1a9af8`, and `flyio-new-files` at `f87867a10ae18317c65910b3333f45d3b11f09a8`; keep local `main` and its worktree untouched; no force push, rewrite, merge, deletion of Lisbon, application commit push, deploy, release, or other ref mutation | 2026-07-25 20:26 WEST | Consumed once at 20:27-20:29 WEST after exact ref/default/protection preflight: archive tag resolves exactly `f87867a`; GitHub default is `Eth_global_lisbon_`; atomic deletion removed exactly the six authorized branches; post-readback exposes only Lisbon at `00147dd`; local `main` remains `bfa7bd3` in its separate worktree. Railway project binding was not mutated and remains a separate readiness check. |
| Vercel deployment | `NOT_AUTHORIZED` |  | Exact project/environment/SHA |  |  |
| Railway deployment | `NOT_AUTHORIZED` |  | Exact project/service/environment/SHA |  |  |
| `GRAPH-CONTINUITY-DEPLOY-20260725-01` | `NOT_AUTHORIZED` |  | Exact frozen SHA, origin branch/ref, Vercel project/environment, Railway project/service/environment, runtime env revision, domains, and rollback tuple |  | Push and each deployment require separate exact authority if their effects differ. |
| `GRAPH-CONTINUITY-SUBMIT-20260725-01` | `NOT_AUTHORIZED` |  | Exact public repository commit, 2-4 minute video URL, ETHGlobal Lisbon project/submission ID, prize selection, text, screenshots, and one final submit action |  | Drafting is local; form submission/public claims are blocked. |
| Mainnet value | `PROHIBITED` | Project owner | Zero | Permanent current contract |  |

An authorized probe does not authorize product integration, deployment, or track promotion.

`AUTHORIZED_ONCE` is self-consuming when the named remote/effect observably equals the exact containing commit. Any descendant commit, repeat push with new objects, PR, merge, tag, release, or other effect requires a new authorization row.
