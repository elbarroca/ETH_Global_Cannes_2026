---
title: Lisbon 2026 Previous Winner Patterns
tags:
  - ethglobal/lisbon-2026
  - winners
  - product-selection
status: reviewed
updated: 2026-07-16
confidence: mixed
---

# Lisbon 2026 Previous Winner Patterns

Official showcase descriptions are entrant-authored. Award metadata is official; runtime claims are `UNVERIFIED` unless public repo evidence is cited.

## Comparable Project Matrix

| project | user loss / thesis | replayable live loop | load-bearing sponsor primitives | inspectable artifact | repo depth / award evidence | likely strength | weakness to beat / do not copy |
|---|---|---|---|---|---|---|---|
| [Alpha Dawg](https://ethglobal.com/showcase/alpha-dawg-fh6vm) | Traders cannot trust black-box agents; paid specialists debate before action. | hire -> infer -> debate -> approve -> trade -> log | 0G inference/storage; Hedera HCS/HTS/schedules; Arc x402 | proof/payment/chain IDs | Deep public repo; Cannes multi-award | Memorable money/brain/truth story | Fail-open proof, forced decision, static providers, breadth. Lisbon work must not relabel Cannes evidence. |
| [DIVE](https://ethglobal.com/showcase/dive-5hxbp) | Oracle disputes are centralized or plutocratic; human-backed agents resolve them. | market -> evidence -> commit/reveal -> consensus -> settlement | World uniqueness; 0G compute/storage; Hedera consensus/value | committee votes and settlement | Public repo; finalist + three sponsor signals | Every sponsor owns a guarantee | Large swarm scope; do not clone oracle-market framing. |
| [Shawarma Orchestrate](https://ethglobal.com/showcase/shawarma-orchestrate-rfyhe) | DeFi agents need controlled, verifiable orchestration. | configure -> reason -> threshold -> approve -> act | 0G compute/storage; DeFi action adapter | plan/confidence/action record | Public repo; 0G first place | Reusable developer artifact | Optional paths can look configured rather than executed; avoid generic orchestrator. |
| [maki](https://ethglobal.com/showcase/maki-564eg) | A model must not hold signing authority. | intent -> deterministic build -> simulate -> policy -> hardware approval -> tx | Uniswap action plus isolated signing | simulation, clear-sign screen, tx | Public repo; finalist | Safety boundary is the product | Hardware dependence; do not clone natural-language DeFi copilot. |
| [npmguard](https://ethglobal.com/showcase/npmguard-aeihd) | Package risk is opaque and reports are not portable. | package -> analysis -> score -> publish -> resolve | ENS subnames/records; content storage | ENS-resolved audit record | Public repo; finalist + ENS third | ENS is a trust registry | Similar package-audit ideas are rejected unless mechanism changes materially. |
| [VEIL VPN](https://ethglobal.com/showcase/veil-vpn-c643n) | Users cannot verify no-log VPN claims. | choose node -> verify attestation -> prove human -> pay -> connect | TEE; ENS discovery; World uniqueness; payments | attested node record/session payment | Public repo; finalist + three first-place signals | Concrete privacy promise | Four-system setup and physical network risk; do not reuse VPN wedge. |
| [OpenCompliance](https://ethglobal.com/showcase/opencompliance-b89x9) | Institutions need private per-trade compliance. | request -> private checks -> allow/deny -> state change | privacy workflow/attestation; DeFi action | policy verdict and transaction outcome | Public repo; Chainlink privacy award | Refusal is judge-visible value | Compliance claims require real policy authority; avoid fake legal certainty. |
| [SENTINEL](https://ethglobal.com/showcase/sentinel-91nv5) | Wallet risk scores are opaque. | collect -> score in TEE -> aggregate -> attest | TEE nodes and onchain proof | verifiable risk attestation | Public repo; Flare award | Proof-carrying security decision | A score without a routed/blocking outcome is weak. |
| [Clawback](https://ethglobal.com/showcase/clawback-vpmw2) | Machine payments lack disputes and refunds. | pay -> escrow -> deliver -> dispute -> adjudicate -> refund/release -> reputation | Arc/x402; confidential attester; ENS/ERC-8004 | escrow and dispute outcome | Public repo; ENS award | Failure handling completes commerce | Too close to AlphaDawg/ProofCart; do not build another generic agent escrow. |
| [Azimuth](https://ethglobal.com/showcase/azimuth-7w256) | Distributed data needs storage, automation, and durable identity. | capture -> merge -> store -> automate -> reward -> resolve identity | Walrus; Hedera; ENS | blob, schedule/payment, ENS resolution | Public repo; three partner awards | Exceptional proof density | Multi-dashboard/hardware reproduction risk; do not create sponsor tour. |
| [Better Wallet](https://ethglobal.com/showcase/better-wallet-yvjdh) | Users sign transactions they cannot safely inspect. | construct -> NFC transfer -> review -> sign -> broadcast | Uniswap stack + air-gapped signer | physical review and signed tx | Public repo; Uniswap Stack award | Tangible unsafe/safe contrast | Hardware is not available to a solo clean-room build; copy the clarity, not device. |
| [Carry](https://ethglobal.com/showcase/carry-b4wcm) | LPs chase gross APR while LVR erodes returns. | read position -> model LVR -> compare -> recommend | Uniswap position/state data | net-return calculation | Public repo; no award confirmed | One hidden loss becomes visible | Analytics without action is insufficient for current sponsor tracks. |
| [AgentIndex](https://ethglobal.com/showcase/agentindex-psxxo) | Agents lack explainable counterparty reputation. | ingest history -> resolve ENS -> score -> rank/block | ENS; ERC-8004; indexed chain history | reasoned rank and identity record | Public repo; ENS second | Reputation changes routing | Rebuilding a dashboard without a new outcome is decorative. |
| [Proof-of-Human](https://ethglobal.com/showcase/proof-of-human-1cg2d) | Bots capture scarce trials and rewards. | verify human -> claim one slot -> pay -> deterministic draw/reset | World AgentKit/ID; payment | nullifier/claim/payment/draw | Public repo; World first | Deterministic reset and replay | World details are pending in Lisbon; no current track inference. |
| [Chatter](https://ethglobal.com/showcase/chatter-hczx1) | Research must convert into an inspectable economic action. | research -> brief -> quote -> swap -> receipt | Uniswap + ENS | published transaction/receipt | Public repo; Continuity multi-award | Excellent before/after delta | Cached research or quote-only execution weakens proof. |

## Tested Winner Model

`one legible loss -> one replayable loop -> one sponsor-native state change -> one visible proof artifact -> one credible user wedge`

| test | result | evidence |
|---|---|---|
| Legible loss | `SUPPORTED` | maki/Better Wallet: unsafe signing; Carry: hidden LVR; Clawback: no refund; npmguard: package risk. |
| Replayable loop | `SUPPORTED` | Proof-of-Human reset/draw; Maki simulate/policy/sign; DIVE commit/reveal; Chatter research/swap. |
| Sponsor-native state change | `SUPPORTED` | World uniqueness, Hedera settlement/HCS, ENS records, Uniswap execution, 0G proof/storage. |
| Visible artifact | `SUPPORTED` | Explorer transaction, nullifier, ENS record, blob/proof, escrow status, hardware approval. |
| Narrow adoption wedge | `SUPPORTED` | Package install safety, subscription control, LP risk, API trials, agent payments. |
| More sponsors improves odds | `REJECTED` | Sponsor count helps only when each owns a distinct invariant; breadth increases demo failure. |

## Implications

- AlphaDawg must lead with `tampered proof -> no action`, not a marketplace tour.
- ProofRail must show tampered-proof/stale-quote refusal before its captured success chain; the zero-effect failure and recovery state are the memorable moments.
- AquaSentinel must execute official Aqua/SwapVM token movement and reject one unsafe program; a dashboard alone fails.
- SealSwitch must prove decryption/access changes through Sui/Walrus/Seal, not merely upload a blob.
- The Graph and World remain provisional; prior winner fit does not create a current Lisbon track.
