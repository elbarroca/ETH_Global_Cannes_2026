# A5 - conditional Uniswap writer

Copy the block into a dedicated Codex project/thread.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/ALPHADAWG-FILE-MAP.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless the exact row in docs/lisbon/EXTERNAL-EFFECTS.md is AUTHORIZED
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- no live identifier, no live claim
Own the sole writer slot for the conditional Uniswap slice. Implement nothing unless Goal U0 and the coordinator explicitly admit an honest product or Continuity path.

ADMISSION
- A1-A4 pass; protected 0G+ENS core is frozen and green.
- The frozen core SHA passes clean-clone install/build/start and two resettable four-minute 0G+ENS replays.
- U0 returned ADMIT_STACK_CONTINUITY, or written organizer/sponsor evidence separately admits the regular API track. `API_PRODUCT_ONLY_NO_TRACK` cannot open a prize claim.
- EXTERNAL-EFFECTS.md authorizes the needed API, form, signing, network, assets, wallet, and cap separately.
- At least six engineering hours remain before feature freeze.
- If any condition fails, record `CUT_UNISWAP` and make no code change.

IMPLEMENT
- Keep model output advisory. Deterministic policy and explicit human approval bind chain, token in/out, atomic amount, recipient, slippage, deadline, spender, target, function selector, quote/request ID, and expected final status.
- Use the official Uniswap API with a valid Developer Platform key only if admitted. Runtime-validate every external response.
- Persist prepared transaction/calldata hash and approval before signature; reconcile the same tx/request after ambiguous broadcast.
- Failed routing, signing, broadcast, receipt, or balance-delta verification stays failed. Never use AlphaDawgSwap/self-transfer as Uniswap success.
- For Stack Contribution, produce genuinely reusable tooling outside AlphaDawg, public code pointers, tests/example, FEEDBACK.md, and authorized feedback-form submission. A one-off API wrapper cannot claim Stack. Do not impose API-key or transaction-ID requirements on Stack unless the selected contribution actually needs them.
- Never settle or trade the same JobIntent twice.

TEST
- valid authorized quote/execution/finality and balance deltas
- wrong chain/token/recipient/amount/slippage/deadline/spender/target/selector
- malformed/tampered API response and calldata
- duplicate/restart/timeout reconciliation
- rejected human approval yields zero signature/broadcast
- provider/API outage and reverted transaction
- removal test proving the claimed Uniswap guarantee disappears

EXIT
- Full checks plus authorized live lifecycle.
- Atomic `feat:` commit, FEEDBACK.md if admitted, public IDs/evidence, release ACTIVE-WRITER.
- Promote only the exact track U0 admitted.
```
