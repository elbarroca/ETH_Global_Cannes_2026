# AlphaDawg Lisbon Control Center

Start a new Codex project at this repository root, then open [`GOALS.md`](GOALS.md).

## Run first

1. Paste **Goal C0** into the primary coordinator thread.
2. After A0 closes, paste **Goal A1** into the only code-writing thread.
3. Run **P0**, **E0**, **U0**, and **Goal VA** in separate read-only threads.
4. Continue writer goals sequentially only when the coordinator opens their gate.

## Controls

- [`BASELINE.md`](BASELINE.md): immutable prior state and authorization boundary.
- [`GOALS.md`](GOALS.md): copy-ready autonomous and asynchronous `/goal` prompts.
- [`ACTIVE-WRITER.md`](ACTIVE-WRITER.md): one-writer lock.
- [`EXTERNAL-EFFECTS.md`](EXTERNAL-EFFECTS.md): push/deploy/sign/transaction/spend authorization.
- [`TRACK-MATRIX.md`](TRACK-MATRIX.md): selected and conditional tracks.
- [`CLAIM-MATRIX.md`](CLAIM-MATRIX.md): claim state and evidence gates.
- [`EVIDENCE.md`](EVIDENCE.md): append-only evidence ledger.
- [`FRESH-CLONE.md`](FRESH-CLONE.md): release reproduction record.
- [`AI-DISCLOSURE.md`](AI-DISCLOSURE.md): assisted-work disclosure.
- [`context/`](context/): copied technical plans plus their precedence notice.
- [`archive/`](archive/): complete AlphaDawg research/prompt/source snapshot and user-supplied prize text; provenance only.
- [`evidence/workshop/`](evidence/workshop/): supplied ENSv2 workshop photograph and evidence note.

All implementation stays on `developer`. No prompt may silently broaden authority granted by `EXTERNAL-EFFECTS.md`.

Execution authority is resolved in this order: `EXTERNAL-EFFECTS.md`, `BASELINE.md`, `GOALS.md`, live control matrices, `context/`, then `archive/`. Only files under [`prompts/`](prompts/) are copy-ready; archived prompts are historical and must not be executed.
