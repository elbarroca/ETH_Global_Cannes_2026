# External-Effect Authorization

Missing or incomplete rows are denied. Never record secret values.

Last reconciled: `2026-07-23T19:19:55Z`. No live sponsor call, write, signature, transaction, form, push, deployment, provisioning, migration, or spend occurred during A0/P0/E0/U0.

Autonomous goals cannot change a row from `NOT_AUTHORIZED` to `AUTHORIZED` on their own. The coordinator may mirror a separate authenticated project-owner instruction only when it binds the exact effect, release SHA, provider/network, cap/scope, and timestamp. Signing/broadcast approval must also bind effect ID, asset, recipient, spender/target, atomic amount cap, deadline, nonce, and policy version; consume it once and reconcile ambiguous outcomes without replacement.

| Effect | State | Owner | Cap/scope | Authorized at | Evidence |
|---|---|---|---|---|---|
| Local files and commits on `developer` | `AUTHORIZED` | Project owner | AlphaDawg Lisbon worktree only | 2026-07-23 18:06 WEST | Thread authorization archived in `BASELINE.md`. |
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
