# A2 - authenticated marketplace and hiring kernel writer

C0-owned task template. Do not launch it manually.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- dispatcher: Goal C0 only
- dispatch_capability: required; C0 supplies task_instance_id, generation, dispatch/target/control SHA, goal source, dependencies, deadline, acceptance items, and retry budget
- writer_admission: sole writers additionally require admitted_at_sha, prerequisite digest, allowed paths, and unconsumed single-use admission
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/ALPHADAWG-FILE-MAP.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless exact current project-owner authorization passes
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- canonical_return_envelope: required by C0
- no live identifier, no live claim

DISPATCH GUARD
- Do not self-start. Require a current single-use Goal C0 packet for this exact goal.
- Verify `mode: sole_writer`, unique `task_instance_id`, generation, `dispatch_sha`, target/control SHA, `goal_source`, `admitted_at_sha` equal to current admitted HEAD, prerequisite verdict digest, exact allowed paths, deadline, and unconsumed admission.
- Missing, stale, mismatched, reused, non-C0, or already-terminal admission returns `BLOCKED_NOT_DISPATCHED` before lease acquisition, edit, install, command, or external action.
- Return only the canonical C0 envelope; this task cannot open its own gate.Own the sole writer slot for A2. Replace AlphaDawg's trust-on-userId marketplace behavior with one authenticated creator, one immutable agent version, one authenticated buyer, and one replay-safe job lifecycle.

PRECONDITIONS
- A1 is green on one SHA.
- Claim ACTIVE-WRITER for prisma/schema.prisma, new migrations, src/auth/**, src/commerce/**, the minimum existing marketplace routes/UI seam, tests, and Lisbon controls.
- Inspect every caller before changing shared auth, user, marketplace, cycle, deposit, withdraw, configure, or trade behavior.

IMPLEMENT
- EIP-4361-compatible wallet challenge bound to domain, chain, account, action, nonce, audience, and expiry; consume once.
- Derive user/creator/buyer identity server-side. Caller-supplied userId, owner, payout, active, endpoint, price, or proof flags never grant authority.
- Immutable AgentVersion with canonical manifest/input/output/tool-policy/provider/proof hashes.
- Creator lifecycle: authenticated draft -> immutable version -> validated dry run -> published/discoverable version -> suspended/archived.
- Buyer lifecycle: discover -> exact version quote -> accept -> order -> job -> verified delivery -> canonical receipt.
- Canonical Quote and JobIntent with stable domain-separated SHA-256 serialization; bind buyer, creator, version, task/input, atomic price, asset/network, payout, expiry, and nonce. Reject floats, undefined, malformed addresses, and unknown variants.
- Explicit job states, append-only events, optimistic state version, bounded lease/heartbeat/recovery, and deterministic effect IDs.
- Database uniqueness for owner/slug, agent/version, manifest, quote, buyer/idempotency key, order, job/effect, settlement, commission/refund, and receipt.
- Implement typed Settlement, CommissionEntry, and Refund state with mutually exclusive terminal outcomes and at-most-one constraints. Local tests may use an explicit fake rail; it is never sponsor evidence. No live value rail runs without separate authorization.
- One protected demo loop only. Reputation, trading, marketplace breadth, and arbitrary tools stay outside the critical path.
- Quarantine legacy mutating endpoints from the Lisbon flow until they use the same authenticated boundary.

TEST
- malformed/expired/cross-domain/replayed signatures
- forged/cross-user create, configure, hire, cycle, deposit, withdraw, and trade attempts create zero mutation/effects
- immutable-version mutation refusal
- legal and illegal state transitions
- 20 concurrent identical submissions create one job and one effect identity
- duplicate/concurrent settlement produces at most one settlement and one commission; a failed delivery produces no commission and an explicit refund/recovery state
- crash before effect, after effect receipt, and before terminal persistence reconciles without duplication
- cancellation, lease expiry, restart, terminal failure, unknown external data

EXIT
- Run lint, typecheck, tests, build, and disposable migration replay.
- Commit one atomic `feat:` change, update evidence/changelog, release ACTIVE-WRITER.
- Do not integrate 0G, ENS, or Uniswap yet.
```
