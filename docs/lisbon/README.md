# AlphaDawg Lisbon Control Center

Start a new Codex project at this repository root, then open [`GOALS.md`](GOALS.md).

## Run first

1. Open one Codex project on `developer` and paste **Goal C0 only**.
2. C0 reads the split prompt files and dispatches bounded subagents itself; never launch A1/P0/E0/U0/VA or another writer manually.
3. Treat existing sidebar tasks as stopped, unverified reports until C0 ingests a complete SHA-bound handoff.
4. Current expected state is `NARROW / WAIT_GATE`: A0 and P0 block product work, so C0 must not open A1 yet.

## Controls

- [`BASELINE.md`](BASELINE.md): immutable prior state and authorization boundary.
- [`ALPHADAWG-FILE-MAP.md`](ALPHADAWG-FILE-MAP.md): internal entry points and complete file-coverage contract.
- [`ALPHADAWG-FILE-MANIFEST.csv`](ALPHADAWG-FILE-MANIFEST.csv): SHA-256 manifest for all 244 mirrored research files.
- [`GOALS.md`](GOALS.md): copy-ready autonomous and asynchronous `/goal` prompts.
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

Execution authority is resolved in this order: `EXTERNAL-EFFECTS.md`, `BASELINE.md`, `GOALS.md`, live control matrices, `context/`, then `archive/`. Only files under [`prompts/`](prompts/) are copy-ready; archived prompts are historical and must not be executed.
