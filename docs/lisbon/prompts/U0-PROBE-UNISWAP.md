# U0 - asynchronous Uniswap probe

Copy the block into a dedicated Codex project/thread.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless the exact row in docs/lisbon/EXTERNAL-EFFECTS.md is AUTHORIZED
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- no live identifier, no live claim
Determine the smallest honest Uniswap path for AlphaDawg and prove SDK/API compatibility without modifying the product checkout or executing value.

BOUNDARY
- Product repo is read-only; use a disposable directory.
- Use current official ETHGlobal Uniswap prize text, Uniswap Developer Platform/docs, Uniswap AI/open-source repos, and feedback form only.
- Distinguish `Best Uniswap API Integration` from Continuity-only `Best Uniswap Stack Contribution`.
- Never assume a regular API track accepts this Continuity project without written admission.
- Do not request quotes with private user data, sign calldata, approve tokens, or broadcast value unless a later writer has explicit authorization.

PROVE
- Current API auth/version/endpoints and supported networks/assets.
- Quote/route response fields required to bind chain, token in/out, amount, recipient, slippage, deadline, spender, target, calldata selector, request ID, and final status.
- Whether existing AlphaDawg can produce reusable Uniswap ecosystem tooling rather than a one-off API call. The current Lisbon Stack track does not require an API key unless the chosen contribution actually uses the API.
- Mandatory public repo, README code pointers, FEEDBACK.md, and feedback-form requirements; verify the form is reachable.

RETURN
- ADMIT_STACK_CONTINUITY, API_PRODUCT_ONLY_NO_TRACK, BLOCKED_ELIGIBILITY, REJECT_COSMETIC, or FAIL.
- Exact official sources, packages/API version, read-only request examples, proposed removal test, required artifacts, and recheck time.
- No product edit, commit, form submission, signature, transaction, or track claim.
```
