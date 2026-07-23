# AlphaDawg Lisbon Control Center

Start one persistent Codex task at this repository root, then paste [`prompts/C0-COORDINATOR.md`](prompts/C0-COORDINATOR.md).

## Run first

1. Open one persistent task on `developer` and paste C0 only.
2. C0 reads `GOALS.md` and `SPRINTS.md`, then instantiates the reusable executor and auditor prompts itself.
3. Never launch a sprint writer manually or trust an unverified task result.
4. C0 derives current state from the live controls; prompt timestamps are never gate evidence.

## Controls

- [`BASELINE.md`](BASELINE.md): immutable prior state and authorization boundary.
- [`ALPHADAWG-FILE-MAP.md`](ALPHADAWG-FILE-MAP.md): internal entry points and complete file-coverage contract.
- [`ALPHADAWG-FILE-MANIFEST.csv`](ALPHADAWG-FILE-MANIFEST.csv): SHA-256 manifest for all 244 mirrored research files.
- [`GOALS.md`](GOALS.md): canonical outcome, authority, evidence, verification, and release contract.
- [`SPRINTS.md`](SPRINTS.md): ordered sprint acceptance cards, including functionality and UI testing.
- [`prompts/`](prompts/): one launch prompt plus reusable writer and auditor templates.
- [`ACTIVE-WRITER.md`](ACTIVE-WRITER.md): one-writer lock.
- [`EXTERNAL-EFFECTS.md`](EXTERNAL-EFFECTS.md): push/deploy/sign/transaction/spend authorization.
- [`TRACK-MATRIX.md`](TRACK-MATRIX.md): selected and conditional tracks.
- [`CLAIM-MATRIX.md`](CLAIM-MATRIX.md): claim state and evidence gates.
- [`EVIDENCE.md`](EVIDENCE.md): append-only evidence ledger.
- [`FRESH-CLONE.md`](FRESH-CLONE.md): release reproduction record.
- [`AI-DISCLOSURE.md`](AI-DISCLOSURE.md): assisted-work disclosure.
- [`context/`](context/): copied technical plans plus their precedence notice.
- [`archive/`](archive/): full byte-for-byte research-vault mirror plus user-supplied evidence; provenance only.
- [`evidence/workshop/`](evidence/workshop/): supplied ENSv2 workshop photograph and evidence note.

All implementation stays on `developer`. No prompt may silently broaden authority granted by `EXTERNAL-EFFECTS.md`.

Execution authority is resolved in this order: `EXTERNAL-EFFECTS.md`, `BASELINE.md`, `GOALS.md`, `SPRINTS.md`, live control matrices, `context/`, then `archive/`. Only files under [`prompts/`](prompts/) are copy-ready; archived prompts are historical and must not be executed.
