# Winner-finalist pattern analysis

Research date: 2026-06-22

Confidence scale:
- High: directly supported by official ETHGlobal event, prize, or project pages.
- Medium: inferred from multiple official project examples or one official example plus prize criteria.
- Low: plausible pattern with limited sample support.

## Source base

EXTRACTED facts:
- [high] ETHGlobal Cannes 2026 ran April 3-5, 2026 in Cannes, France, with 800+ attendees, 11+ protocols, 29+ workshops, and $150,000 in prizes. Themes listed by ETHGlobal included Zero Knowledge Proofs, AI x Crypto, DeFi, Crypto Consumer, Layer 2s, Interoperability, Public Goods, Privacy & Security, TEEs, Data Availability, Identity, and DevTools. Source: https://ethglobal.com/events/cannes2026
- [high] ETHGlobal New York 2026 ran June 12-14, 2026 in New York City, with 800+ attendees, 15+ protocols, 29+ workshops, and $175,000 in prizes. It listed the same broad theme set and introduced "Start over. Continue building.", allowing empty repos, extending open source, or shipping a feature on an existing product. Source: https://ethglobal.com/events/newyork2026
- [high] ETHGlobal submission guidance states finalist projects present 7 minutes total: 4 minutes of demo and 3 minutes of Q&A. Judging criteria are technicality, originality, practicality, usability, and wow factor. Demo videos are encouraged, must be 2-4 minutes, and should show the project in action. Source: https://ethglobal.com/events/cannes2026/info/details
- [high] Cannes and New York partner prize rules repeatedly require functional demos, public repos, clear README/setup material, real onchain execution where applicable, architecture diagrams for Arc, non-hardcoded ENS demos, meaningful World ID/AgentKit constraints, and Chainlink state changes rather than front-end-only data display. Sources: https://ethglobal.com/events/cannes2026/prizes/world, https://ethglobal.com/events/cannes2026/prizes/arc, https://ethglobal.com/events/cannes2026/prizes/ens, https://ethglobal.com/events/cannes2026/prizes/chainlink, https://ethglobal.com/events/newyork2026/prizes

## Extracted project evidence

EXTRACTED facts:
- [high] DIVE was a Cannes 2026 finalist and won World Minikit 2.0 1st place, a Hedera AI/agentic payments prize, and 0G OpenClaw Agent 2nd place. It framed oracle resolution as an AI swarm tied to unique human identity, with randomized committees, evidence, reasoning, commit-reveal voting, and consensus. Source: https://ethglobal.com/showcase/dive-5hxbp
- [high] VEIL VPN was a Cannes 2026 finalist and won 1st place tracks from World ID 4.0, Arc agentic economy/nanopayments, and ENS. It used TEE attestation for no-log VPN nodes, ENS subdomains for attested nodes, World ID for human-only service, and Circle/Arc nanopayments. Source: https://ethglobal.com/showcase/veil-vpn-c643n
- [high] Maki was a Cannes 2026 finalist. It built an onchain DeFi agent where the model interprets intent but deterministic code builds transactions, simulates, policy-checks, renders summaries, and routes final approval to Secure Enclave or Ledger signing. Source: https://ethglobal.com/showcase/maki-564eg
- [high] NpmGuard was a Cannes 2026 finalist and won ENS Most Creative Use 3rd place. It audited npm packages with AI/static/dynamic checks, published scores/reports through ENS subnames and IPFS, and supported on-demand paid audits. Source: https://ethglobal.com/showcase/npmguard-aeihd
- [high] PaintGlobal was a Cannes 2026 finalist. It tied an onchain art gallery to the actual hackathon painting workshop and used official NFC wristbands as physical identity for one-participant-one-vote ranking. Source: https://ethglobal.com/showcase/paintglobal-v4pwo
- [high] Shawarma Orchestrate won 0G Best DeFi App 1st place at Cannes 2026. It used 0G Compute/Storage, LangGraph multi-agent orchestration, structured outputs, confidence thresholds, optional human approval, and Uniswap execution. Source: https://ethglobal.com/showcase/shawarma-orchestrate-rfyhe
- [high] Proof-of-Human won World Track A AgentKit 1st place at New York 2026. It used one verified human per raffle slot, supported both web users and AI agents through a shared backend, enforced uniqueness at the database layer, included a reset console and deterministic draw, and settled real USDC payments on World Chain Sepolia. Source: https://ethglobal.com/showcase/proof-of-human-1cg2d
- [high] Nyx won Chainlink and Canton prizes at New York 2026. It combined a private perp DEX, Canton/Daml private orderbook settlement, and yield-bearing RWA collateral. Source: https://ethglobal.com/showcase/nyx-prk3o
- [high] AgentIndex won ENS Best ENS Integration for AI Agents 2nd place at New York 2026. It ingested ERC-8004 registry history through BigQuery, enriched with ENS links, and surfaced sybil/anomaly/reviewer-independence trust signals. Source: https://ethglobal.com/showcase/agentindex-psxxo
- [high] Better Wallet won Uniswap Best Uniswap Stack Contribution at New York 2026. It demonstrated real hardware, offline clear signing, NFC payload transfer, and on-device review. Source: https://ethglobal.com/showcase/better-wallet-yvjdh
- [high] Clawback won an ENS pool prize at New York 2026. It routed x402-style agent payments into Arc escrow, used Chainlink CRE and a confidential AI attester for disputes, mirrored reputation into ENS/ERC-8004, and exposed an MCP control plane. Source: https://ethglobal.com/showcase/clawback-vpmw2
- [high] Carry was a New York 2026 project that showed LP returns net of loss-versus-rebalancing, using live Uniswap/Base state, volatility, range simulation, and recommendations. Source: https://ethglobal.com/showcase/carry-b4wcm
- [high] Scoutxyz was a New York 2026 project that used World ID, ENS, Dynamic wallets, x402-paid search/enrichment, and agent timelines for event networking agents. Source: https://ethglobal.com/showcase/scoutxyz-rwueo

## Inferred winner/finalist patterns

INFERRED reasoning:
- [high] Sponsor technology must be causally necessary, not decorative. Winning examples make the sponsor primitive part of the core state transition or user promise: World enforces uniqueness, ENS creates discoverability or reputation, Chainlink changes onchain outcomes, Arc/Circle settles programmable stablecoin flows, Canton supplies privacy, 0G supplies AI compute/storage, Ledger/hardware controls signing.
- [high] "Agentic" projects perform better when bounded by identity, policy, escrow, attestations, or deterministic execution. DIVE, VEIL VPN, Maki, Proof-of-Human, Scoutxyz, AgentIndex, and Clawback all pair agents with constraints that make autonomous behavior safer or auditable.
- [high] The strongest demos show a complete loop: user intent -> sponsor-native action -> onchain or verifiable artifact -> readable result -> replay path. Proof-of-Human's deterministic draw/reset, Maki's simulate/policy/sign path, Better Wallet's two-tap hardware flow, and Clawback's escrow/dispute/reputation flow all have judge-friendly replay mechanics.
- [medium] Finalist-level projects often combine one narrow wedge with two or three sponsor integrations that each do a different job. The pattern is not "many logos"; it is "identity + settlement + verification" or "agent compute + execution + safety." Applying for the maximum partner slots works only when each integration is in the critical path.
- [medium] The practical verticals with strongest signal are agent commerce, proof-of-human access, private/compliant finance, risk-aware DeFi automation, developer/security tooling, clear signing, and real-world/event-linked consumer apps.
- [medium] "Trust layer" language maps well to judge expectations when it is backed by an artifact: ENS records, onchain reputation, attestation hashes, verified contracts, tx IDs, package audit reports, hardware approval logs, or reproducible dashboards.
- [medium] Physical or local context helps only when it proves something. PaintGlobal used wristbands for identity, Better Wallet used real hardware for clear signing, and Proof-of-Human used a deterministic live draw; these are stronger than local branding alone.
- [medium] Continuity-track readiness matters after New York 2026. Teams with an existing product should prepare a clean diff narrative: what existed before, what was shipped during the event, which new feature is open source, and why the sponsor integration materially improves the product.

## Sponsor-fit mechanics

INFERRED reasoning:
- [high] ENS fit: name agents, people, treasuries, or resources; write meaningful text records; make names resolve inside the product; avoid using ENS only as a wallet-login badge. Sources: https://ethglobal.com/events/cannes2026/prizes/ens, https://ethglobal.com/events/newyork2026/prizes
- [high] World fit: make personhood a real constraint: one-per-human allocation, anti-bot trials, human-backed agents, reputation, fairness, or rate limits. Proof validation should happen server-side or onchain. Sources: https://ethglobal.com/events/cannes2026/prizes/world, https://ethglobal.com/events/newyork2026/prizes
- [high] Chainlink fit: use CRE/CCIP/feeds/VRF/attesters to produce a blockchain state change or trusted workflow output; front-end display alone is explicitly weak. Sources: https://ethglobal.com/events/cannes2026/prizes/chainlink, https://ethglobal.com/events/newyork2026/prizes
- [high] Arc/Circle fit: show stablecoin-native programmable flows: escrow, payroll, conditional release, nanopayments, agent commerce, crosschain USDC liquidity, or prediction/hedging markets. Include functional MVP, architecture diagram, and video. Sources: https://ethglobal.com/events/cannes2026/prizes/arc, https://ethglobal.com/events/newyork2026/prizes
- [medium] Hedera fit: emphasize native services, payment speed/cost, HCS audit trails, scheduled transactions, HTS tokenization, or agentic payments. New York criteria specifically reward real payment/token/financial operations and public repos with demo video. Source: https://ethglobal.com/events/newyork2026/prizes
- [medium] Uniswap fit: show real routing/liquidity/contribution rather than a generic swap button. Stronger angles are LP intelligence, v4 hooks, API-driven execution, or open-source stack improvements. Sources: https://ethglobal.com/events/newyork2026/prizes, https://ethglobal.com/showcase/carry-b4wcm, https://ethglobal.com/showcase/better-wallet-yvjdh
- [medium] 0G fit: use compute, storage, chain, DA, or iNFTs to make AI-native behavior persistent, verifiable, ownable, or economically self-sustaining. Source: https://ethglobal.com/events/cannes2026/prizes/0g

## Demo qualities that correlate with stronger outcomes

INFERRED reasoning:
- [high] Open with the user failure, not the protocol stack. The best project pages are legible as products before they are integrations: bot-proof drops, no-log VPN proof, safe agent signing, npm package trust, private perp DEX, clear signing.
- [high] Keep the live path deterministic. Judges need to see the same win state repeatedly: reset button, seeded draw, fixed test wallets, replayable tx IDs, preloaded sample package, staged escrow dispute, or hardware loop.
- [high] Show sponsor proofs on screen: ENS record, World proof/nullifier behavior, Chainlink workflow result, Arc escrow tx, Uniswap route/position data, Hedera transaction, Canton privacy boundary, 0G storage/inference artifact.
- [high] Prepare the exact artifacts prize pages ask for: public repo, README/setup, demo video, tx IDs, architecture diagram where required, and clear explanation of which sponsor features or SDKs were used.
- [medium] The video should be edited for judge comprehension but not fake the product. ETHGlobal guidance says show the project in action, avoid waiting, keep intro under 20 seconds, avoid sub-720p exports, and do not exceed 4 minutes.

## Anti-patterns

INFERRED reasoning:
- [high] Hardcoded sponsor demos. ENS and Arc explicitly call for functional demos; ENS warns against hard-coded values. Source: https://ethglobal.com/events/cannes2026/prizes/ens
- [high] Chainlink as display-only data. Prize criteria require Chainlink to contribute to a blockchain state change for core prizes. Source: https://ethglobal.com/events/cannes2026/prizes/chainlink
- [high] World ID as login only. World prize criteria ask for proof of human as a real constraint: fairness, eligibility, reputation, uniqueness, rate limits, or agent backing. Sources: https://ethglobal.com/events/cannes2026/prizes/world, https://ethglobal.com/events/newyork2026/prizes
- [medium] Generic AI wrappers. Agent projects need evidence, settlement, reputation, permissions, or trusted execution; otherwise they are hard to distinguish from normal prompt automation.
- [medium] Too many partner claims with no primary story. Strong projects can use several sponsors, but the product must still have one clear wedge and a judge-replayable core loop.

## Practical build heuristic

INFERRED reasoning:
- [medium] A competitive ETHGlobal project should be scoped as: one painful workflow, one sponsor-native primitive that cannot be removed, one verifiable state change, one replayable demo, one public repo with setup, and at most two secondary sponsor integrations that explain why the core loop is safer, cheaper, more private, or more useful.
