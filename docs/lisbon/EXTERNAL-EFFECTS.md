# External-Effect Authorization

Missing or incomplete rows are denied. Never record secret values.

Control state: `LIVE_EFFECT_BLOCKED`.

This state is independent from `LOCAL_BUILD_AUTHORIZED`: local files, tests, loopback processes, disposable local databases, and atomic commits on the exact authorized branch are allowed when they cannot affect a shared or external system. It also preserves `RELEASE_BLOCKED`; local success grants no push, deployment, submission, or claim authority.

Last reconciled: `2026-07-24T13:10:56Z`. A4 used only local files, deterministic resolver fixtures, the preserved local Go toolchain, generated build output, and disposable loopback PostgreSQL. No live ENS/0G read or write, shared database, or other external effect was attempted. The project owner previously authorized one documentation/control commit on new branch `Eth_global_lisbon_` and one push of that exact containing commit; that one-time push is already consumed by the observed remote control SHA and does not authorize this A4 commit or any descendant push. No PR, merge, deployment, live sponsor call, managed migration, signature, transaction, form, funding, upload, spend, or claim promotion is authorized.

Autonomous goals cannot change a row from `NOT_AUTHORIZED` to `AUTHORIZED` on their own. The coordinator may mirror a separate authenticated project-owner instruction only when it binds the exact effect, release SHA, provider/network, cap/scope, and timestamp. Signing/broadcast approval must also bind effect ID, asset, recipient, spender/target, atomic amount cap, deadline, nonce, and policy version; consume it once and reconcile ambiguous outcomes without replacement.

| Effect | State | Owner | Cap/scope | Authorized at | Evidence |
|---|---|---|---|---|---|
| Local files and commits on `developer` | `AUTHORIZED` | Project owner | AlphaDawg Lisbon worktree only | 2026-07-23 18:06 WEST | Thread authorization archived in `BASELINE.md`. |
| Disposable local files, tests, loopback processes, and databases | `AUTHORIZED` | Project owner | Local-only; no shared/external endpoint, account, or system effect | 2026-07-24 00:45 WEST | Current controlling local-build instruction and `BASELINE.md`. |
| Local A4-A7 work on `Eth_global_lisbon_` | `AUTHORIZED` | Project owner | Safe local files, tests, loopback services, disposable databases, and atomic commits only; no shared/external effect | 2026-07-24 12:55 WEST | Current authenticated instruction to create the continuation goal and publish all work on this branch. |
| Documentation/control commit on `Eth_global_lisbon_` | `AUTHORIZED_ONCE` | Project owner | Exact continuation prompt, final A3 audit reconciliation, changelog, and this authorization in the containing commit only | 2026-07-24 12:55 WEST | Current authenticated project-owner instruction. |
| Push `Eth_global_lisbon_` | `AUTHORIZED_ONCE` | Project owner | Push the exact containing commit to `origin/Eth_global_lisbon_`; no force, PR, merge, tag, release, or deployment | 2026-07-24 12:55 WEST | Current authenticated project-owner instruction. |
| Push `developer` | `NOT_AUTHORIZED` |  | Exact remote/commits |  |  |
| `0g_probe` | `NOT_AUTHORIZED` |  | Provider/network/request and spend cap |  |  |
| `0g_live_smoke` | `NOT_AUTHORIZED` |  | Provider/network/request and spend cap |  |  |
| `ens_probe` | `NOT_AUTHORIZED` |  | Namespace/network/write and gas cap |  |  |
| `ens_live_smoke` | `NOT_AUTHORIZED` |  | Namespace/network/write and gas cap |  |  |
| Uniswap API requests | `NOT_AUTHORIZED` |  | Key/project/request cap |  |  |
| Uniswap signature/transaction | `NOT_AUTHORIZED` |  | Chain/assets/amount/gas cap |  |  |
| Uniswap feedback-form submission | `NOT_AUTHORIZED` |  | Exact form and FEEDBACK.md SHA |  |  |
| Sui/Walrus/Seal effects | `NOT_AUTHORIZED` |  | Network/object/request/gas cap |  |  |
| Database provisioning/migration | `NOT_AUTHORIZED` |  | Exact project/database/schema |  |  |
| Vercel deployment | `NOT_AUTHORIZED` |  | Exact project/environment/SHA |  |  |
| Railway deployment | `NOT_AUTHORIZED` |  | Exact project/service/environment/SHA |  |  |
| Mainnet value | `PROHIBITED` | Project owner | Zero | Permanent current contract |  |

An authorized probe does not authorize product integration, deployment, or track promotion.

`AUTHORIZED_ONCE` is self-consuming when the named remote/effect observably equals the exact containing commit. Any descendant commit, repeat push with new objects, PR, merge, tag, release, or other effect requires a new authorization row.
