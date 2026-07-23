# Deep Winner and Finalist Debrief 2026

Research date: 2026-06-22

Scope: Cannes 2026 and New York 2026 winners, finalists, and track-winner patterns where official ETHGlobal pages, official social posts, or search-indexed official pages expose enough detail. Project self-descriptions are treated as evidence about what was built, not as independent proof that every technical claim works in production.

## Coverage State

| area | status | note |
|---|---|---|
| Cannes top finalists | enriched | Official/social-indexed finalist slate: ENShell, DIVE, maki, Defi, ALMA, npmguard, VEIL VPN, PaintGlobal, EVM PORST, Corpus. ALMA still needs project-page enrichment. |
| Cannes track winners | enriched where visible | DIVE, VEIL VPN, ENShell, npmguard, OpenCompliance, SENTINEL, Shawarma Orchestrate, Veryclear, and EVM PORST are covered at different depths. |
| New York top finalists | indexed, not fully enriched | Official/social-indexed finalist slate includes Canary, Accrue, Void Tactics, LYNX, Distro, UNSU, update, Proof of Scan, The Wallet Shift, Immunity, and Cumulant, but separators in social search are ambiguous and each page still needs a full official detail pass. |
| New York track winners | enriched where visible | Proof-of-Human, Nyx, AgentIndex, Better Wallet, Clawback, AgentRankr, Azimuth, Ballast, Smile, Carry, and Scoutxyz are covered as winner or strong pattern evidence depending on official prize visibility. |

## What Actually Wins

The dominant pattern is not "use many sponsors." The stronger pattern is "make each sponsor primitive responsible for a specific product guarantee."

Examples:
- DIVE: World handles unique human-backed agents, 0G handles agent compute/storage, Hedera records consensus/token activity.
- VEIL VPN: TEE proves server behavior, ENS discovers attested nodes, World constrains human-only use, payments price the session.
- Proof-of-Human: World AgentKit is not decorative; the raffle and trial mechanics fail without verified uniqueness.
- AgentIndex and AgentRankr: ENS/ERC-8004/indexed history produce a trust surface for agent counterparties.
- Better Wallet and maki: signing safety is the product, not a feature. The demo can show the unsafe path and the safer replacement.

## Why They Likely Won

Judges can only reward what they can understand quickly under time pressure. Winning projects generally had these properties:

1. One obvious failure mode: bot drops, unsafe agent signing, unverified VPN claims, opaque LP returns, missing payment disputes.
2. One replayable loop: request, verify, execute, settle, inspect.
3. One visible proof artifact: ENS record, World nullifier, Chainlink/CRE workflow, Hedera HCS message, Uniswap position data, 0G/Walrus storage proof, hardware approval, escrow state.
4. One sponsor-native reason the product could not exist the same way without that sponsor.
5. One compressed story: "this is unsafe today; here is the artifact that makes it safer."

## Vertical Read

| vertical | evidence | Lisbon implication |
|---|---|---|
| Human-backed agents | DIVE, Proof-of-Human, World AgentKit sources | Build around quotas, eligibility, rate limits, reputation, or delegated agent identity. |
| Agent commerce and disputes | Clawback, x402, ERC-8004, AgentIndex | Payment alone is incomplete. Add escrow, refund, reputation, or adjudication. |
| Wallet and transaction safety | ENShell, maki, Better Wallet, Veryclear | Strong demo shape: malicious/unclear tx enters, policy/simulation/clear-signing blocks or explains it. |
| Private/compliant finance | Nyx, OpenCompliance, SENTINEL, Chainlink privacy standard | Privacy must protect a specific financial action: trade, transfer, compliance check, settlement. |
| DeFi risk and liquidity | Carry, Ballast, Smile, Uniswap hooks, 1inch Aqua | Replace vanity metrics with decision metrics: net APR, LVR, slippage, inventory risk, execution quality. |
| Indexing and reputation | AgentIndex, AgentRankr, The Graph Substreams | Reputation needs explainable factors and a next action: route, block, rank, price, or trust. |
| Event-local consumer apps | PaintGlobal, Scoutxyz | Local context helps only when it produces a proof or matching signal, not when it is just branding. |

## Pitch Mechanics

Strong pitch sequence:

1. Name the user and the loss: "LPs chase gross APR and bleed LVR" or "agents can be prompt-injected into signing malicious transactions."
2. Show the product before naming protocols.
3. Walk the live path once.
4. Pause on the proof artifact.
5. Explain why each sponsor primitive is in the critical path.
6. End with the smallest real-world adoption wedge.

Weak pitch sequence:

- Protocol logo tour before user pain.
- Many integrations but no state change.
- "AI agent" as a wrapper around a prompt.
- World ID as login only.
- ENS as display name only.
- Chainlink as data display only.
- DeFi idea with no measurable improvement.

## Lisbon Build Heuristic

A credible Lisbon build should fit this sentence:

"For [specific user], we prevent or unlock [specific action] by using [primary sponsor primitive] to create [verifiable artifact], then use [secondary primitive] to route, settle, index, or prove the result."

High-conviction examples:
- Human-backed agent API market: World AgentKit + x402 + ENS/ERC-8004 + The Graph.
- LP truth dashboard: Uniswap/Aqua + The Graph + LVR model + route/position recommendation.
- Agent escrow and reputation: x402 + ENS/ERC-8004 + Yellow/Hedera settlement + dispute proof.
- Private compliance router: Chainlink privacy/CRE + Uniswap/1inch + policy artifacts.
- Verifiable agent memory: 0G + ENS + The Graph with signed memory/event proofs.

## Unresolved Gaps

- ALMA project-page details need enrichment.
- New York finalist project pages for Canary, Accrue, Void Tactics, LYNX, Distro, UNSU, update, Proof of Scan, The Wallet Shift, Immunity, and Cumulant need official detail extraction after ETHGlobal rate limits clear.
- Several New York track winners were visible through official pages/search but still need sponsor-specific prize reconciliation against the official prize page.

Primary registers:
- `registers/winner_reasoning.csv`
- `registers/projects.csv`
- `registers/prizes.csv`
- `registers/open_source_protocol_watchlist.csv`
