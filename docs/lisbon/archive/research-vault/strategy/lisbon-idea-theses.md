# Lisbon idea theses

Research date: 2026-06-22

> Historical snapshot. The sponsor surface changed after this review: Yellow was replaced by Sui, the latest supplied snapshot shows $86,000 and 15 released tracks, and ENS added AI Agents plus Continuity. Use [[alphadawg/ALPHADAWG_LISBON_MASTER]], [[dual-project/PROJECT_B_LISBON_MASTER]], and [[../events/ethglobal-lisbon-2026]] for the current decision.

Confidence scale:
- High: directly supported by official ETHGlobal pages.
- Medium: inferred from official ETHGlobal Cannes/New York 2026 pages and project examples.
- Low: useful but dependent on Lisbon-specific track details that are not yet visible in official accessible sources.

## Lisbon source posture

EXTRACTED facts:
- [high] ETHGlobal's official homepage and events page list ETHGlobal Lisbon 2026 as an IRL hackathon in Lisbon, Portugal on July 24-26, 2026. Sources: https://ethglobal.com/, https://ethglobal.com/events
- [high] ETHGlobal's official Lisbon 2026 prize page currently shows 8 visible prize partners: The Graph ($15,000), Yellow ($15,000), World ($15,000), Hedera ($15,000), 0G ($15,000), Uniswap Foundation ($10,000), ENS ($5,000), and 1inch ($5,000), totaling $95,000. Source: https://ethglobal.com/events/lisbon2026/prizes
- [high] The same official Lisbon prize page describes The Graph as decentralized indexing/querying through subgraphs; Yellow as a state-channel clearing network for non-custodial, cross-chain, scalable trading and settlement; World as human/AI distinction and inclusive finance; Hedera as an EVM blockchain with Solidity/SDK support, high throughput, fast finality, low USD-priced fees, and enterprise governance; 0G as decentralized AI infrastructure; Uniswap Foundation as supporting Unichain, Uniswap v4, protocol innovation, developer success, and governance; ENS as naming/pointers; and 1inch as aggregation, intents, Fusion/Fusion+, cross-chain swaps, MEV protection, and APIs. Source: https://ethglobal.com/events/lisbon2026/prizes
- [high] Cannes 2026 and New York 2026 official event pages used the same broad theme set: ZK, AI x Crypto, DeFi, Crypto Consumer, Layer 2s, Interoperability, Public Goods, Privacy & Security, TEEs, Data Availability, Identity, and DevTools. Sources: https://ethglobal.com/events/cannes2026, https://ethglobal.com/events/newyork2026
- [medium] The official Lisbon 2026 event FAQ says Classic Track projects should not start before the event, while Continuity Track projects may build on existing code and expand functionality during the hackathon. It also says Continuity Track partner eligibility should be checked partner-by-partner. Source: https://ethglobal.com/events/lisbon2026
- [medium] I did not find detailed Lisbon 2026 partner-specific track rubrics or qualification requirements beyond visible partners, amounts, and sponsor positioning during this slice. The older https://ethglobal.com/events/lisbon page appears to describe a prior Lisbon event and should not be treated as Lisbon 2026 evidence.

INFERRED reasoning:
- [medium] Lisbon theses should prioritize the visible 2026 sponsor surface: indexed data products, state-channel/cross-chain settlement, human-backed access, Hedera enterprise/identity/tokenization flows, decentralized AI, Uniswap/1inch DeFi execution, and ENS identity/discovery.
- [medium] Each idea below should be implemented with one primary sponsor target and no more than two natural secondary targets until detailed Lisbon track requirements are published.

## Thesis filter

INFERRED reasoning:
- [medium] A Lisbon idea is worth building if it can answer all five questions in one minute:
  - What breaks without crypto or verifiable execution?
  - Which sponsor primitive is in the critical path?
  - What onchain or externally verifiable artifact proves it worked?
  - Can the judge replay the happy path twice in under four minutes?
  - What exact user gets value after the hackathon?

## Thesis 1: Human-backed agent free-trial router

EXTRACTED anchor facts:
- [high] Proof-of-Human won World AgentKit 1st place at New York 2026 with a one-verified-human-one-slot mechanic for both web users and AI agents. Source: https://ethglobal.com/showcase/proof-of-human-1cg2d
- [high] World New York prize criteria called for AgentKit products where human backing improves trials or initial usage, and World ID products where proof of human is a real constraint. Source: https://ethglobal.com/events/newyork2026/prizes
- [high] ENS prize criteria reward agent identity/discoverability when ENS is not cosmetic. Source: https://ethglobal.com/events/newyork2026/prizes

INFERRED Lisbon build:
- [medium] Build a marketplace where SaaS/API providers grant each human-backed agent a limited trial budget. World proves one human; ENS names each agent and exposes capability/reputation records; x402 or stablecoin payments take over after trial credits run out.
- [medium] Sponsor fit: World is the allocation gate, ENS is the discovery/reputation layer, Hedera can record low-cost payment/reputation events, and 0G can provide decentralized agent inference if the product needs AI-native execution.
- [medium] Demo: create a human-backed agent, claim one free API call, attempt a duplicate claim and show denial, then pay for a second call and write reputation/usage to the agent record.
- [medium] Risk: avoid looking like an API wrapper by making trial abuse prevention and agent identity the product.

## Thesis 2: Agent escrow with disputeable delivery

EXTRACTED anchor facts:
- [high] Clawback routed agent payments into escrow and used Chainlink CRE/confidential AI attestation to resolve disputes, with ENS/ERC-8004 reputation records. Source: https://ethglobal.com/showcase/clawback-vpmw2
- [high] Arc prize criteria at Cannes/New York emphasized conditional escrow, programmable USDC/EURC flows, agentic payments, functional MVPs, diagrams, videos, and repos. Sources: https://ethglobal.com/events/cannes2026/prizes/arc, https://ethglobal.com/events/newyork2026/prizes
- [high] Chainlink criteria require a service to contribute to state changes or trusted workflows, not just display data. Sources: https://ethglobal.com/events/cannes2026/prizes/chainlink, https://ethglobal.com/events/newyork2026/prizes

INFERRED Lisbon build:
- [medium] Build "escrow for AI work": a buyer agent pays for a report, code review, data pull, or design asset; funds lock; delivery hashes are committed; a judge workflow releases or refunds; reputation follows the seller agent.
- [medium] Sponsor fit: adapt the Cannes/New York escrow pattern to Lisbon's visible sponsors: Hedera for low-fee escrow/reputation events, Yellow for settlement/channel mechanics if prize rules allow, ENS for agent identity, 0G for AI adjudication, and World where a human-backed buyer or seller matters.
- [medium] Demo: buyer agent requests a deliverable, seller submits one good and one bad response in separate runs, dispute both, show automatic release/refund and updated reputation.
- [medium] Risk: keep adjudication narrow and testable. "Does output satisfy this explicit spec?" is stronger than general AI quality judgment.

## Thesis 3: Private programmable payroll for hacker teams

EXTRACTED anchor facts:
- [high] PayFlow won a Cannes 2026 WalletConnect prize with automated crypto payroll, employee token/network splits, Chainlink CRE, Uniswap quotes, World ID verification, and cross-chain settlement. Source: https://ethglobal.com/showcase/payflow-opz60
- [high] Arc prize pages name programmable payroll/vesting and crosschain USDC flows as target examples. Sources: https://ethglobal.com/events/cannes2026/prizes/arc, https://ethglobal.com/events/newyork2026/prizes
- [high] Canton New York prize criteria emphasized private DeFi, RWA/tokenized assets, payments, neobanking, and privacy by default. Source: https://ethglobal.com/events/newyork2026/prizes

INFERRED Lisbon build:
- [medium] Build a small-team payroll and expense splitter for grants, hackathon bounties, and contractor teams: treasury funds once; members privately choose payout splits; payments execute on schedule or milestone approval.
- [medium] Sponsor fit: Hedera for fast low-fee payouts and enterprise-style auditability, Yellow for settlement/channel mechanics if applicable, 1inch for token conversion/routing, ENS for readable contributor/treasury identities, and World for contractor uniqueness if needed.
- [medium] Demo: fund a team treasury, add three contributors, set private payout preferences, run a milestone payout, and show each recipient gets the right settlement without revealing everyone else's allocations.
- [medium] Risk: the strongest historical payroll examples used Circle/Arc and Chainlink, which are not visible Lisbon prize partners in the current official page. Keep the Lisbon version focused on Hedera/Yellow/1inch mechanics rather than assuming stablecoin-specific tracks.

## Thesis 4: Net-risk DeFi copilot for LPs

EXTRACTED anchor facts:
- [high] Carry explained LP returns net of loss-versus-rebalancing and showed live Uniswap/Base pool data, range dragging, recommendations, and leaderboard ranking by net carry. Source: https://ethglobal.com/showcase/carry-b4wcm
- [high] Shawarma Orchestrate won 0G Best DeFi App 1st place with multi-agent prediction, confidence thresholds, optional approval, 0G compute/storage, and Uniswap actions. Source: https://ethglobal.com/showcase/shawarma-orchestrate-rfyhe
- [high] Uniswap New York criteria rewarded API integrations, real onchain execution, repos, README, tx IDs, and demo videos. Source: https://ethglobal.com/events/newyork2026/prizes

INFERRED Lisbon build:
- [medium] Build an LP decision terminal that converts pool data into "enter, widen, narrow, or exit" recommendations with explainable net yield, volatility, and downside assumptions. Let an agent propose but require deterministic simulation and human approval before execution.
- [medium] Sponsor fit: Uniswap for liquidity/position logic, 1inch for routing/intents, The Graph for indexed pool/history data, Yellow for cross-chain/state-channel settlement angles, and 0G for agent analysis with bounded recommendations.
- [medium] Demo: connect a wallet, pick a pool, show headline APR versus net-risk APR, drag a range, simulate rebalancing, execute or queue one small testnet action, and display tx proof.
- [medium] Risk: avoid opaque "AI says buy." The core should be deterministic math plus transparent assumptions.

## Thesis 5: Open-source dependency trust registry

EXTRACTED anchor facts:
- [high] NpmGuard was a Cannes 2026 finalist and ENS prize winner; it audited packages, generated risk reports, and published verdicts through ENS subnames and IPFS. Source: https://ethglobal.com/showcase/npmguard-aeihd
- [high] Chainlink Cannes criteria rewarded CRE workflows connecting blockchains to APIs/data/LLMs/AI agents and confidential/private workflow use cases. Source: https://ethglobal.com/events/cannes2026/prizes/chainlink
- [high] Cannes/New York themes include DevTools, Privacy & Security, AI x Crypto, and Identity. Sources: https://ethglobal.com/events/cannes2026, https://ethglobal.com/events/newyork2026

INFERRED Lisbon build:
- [medium] Build a registry for package, Docker image, or smart-contract-template risk attestations. A scanner runs static checks, LLM review, sandbox execution, and provenance checks; outputs are anchored to ENS names/IPFS and queryable by agents before install.
- [medium] Sponsor fit: ENS for package identity and report pointers, 0G for decentralized AI analysis, The Graph for indexing/querying attestations, and Hedera for low-cost timestamped audit events.
- [medium] Demo: publish a malicious toy package, run scan, show blocked install through CLI/MCP, update ENS/IPFS report, then show a safe package passing.
- [medium] Risk: scope to one ecosystem and one exploit class for demo reliability.

## Thesis 6: Attested private node marketplace

EXTRACTED anchor facts:
- [high] VEIL VPN won Cannes 2026 prizes from World, Arc, ENS, and was an ETHGlobal finalist using TEE attestation, ENS node names, World ID, and nanopayments. Source: https://ethglobal.com/showcase/veil-vpn-c643n
- [high] Cannes/New York themes include TEEs, Privacy & Security, Identity, and AI x Crypto. Sources: https://ethglobal.com/events/cannes2026, https://ethglobal.com/events/newyork2026
- [high] ENS Cannes criteria explicitly rewarded agent/service identity and useful text records, not cosmetic naming. Source: https://ethglobal.com/events/cannes2026/prizes/ens

INFERRED Lisbon build:
- [medium] Build a marketplace for attested private compute nodes: each node publishes enclave hash, service endpoint, price, uptime, and policy under an ENS subname. Agents buy short-lived compute or data-cleanroom sessions with nanopayments.
- [medium] Sponsor fit: ENS for node registry, 0G for decentralized AI/compute positioning, Hedera or Yellow for metered payment/settlement, and World for human-operated node limits if needed.
- [medium] Demo: register a node, verify attestation, run a small private task, pay per request, and mark reputation from the client.
- [medium] Risk: TEE setup can consume the whole weekend. Pre-build the attestation harness if continuity rules allow.

## Thesis 7: Proof-of-participation event market

EXTRACTED anchor facts:
- [high] PaintGlobal became a Cannes finalist by turning a real event activity into an onchain gallery with NFC wristband identity and sybil-resistant voting. Source: https://ethglobal.com/showcase/paintglobal-v4pwo
- [high] ETHGlobal demo guidance rewards practicality, usability, wow factor, and showing the project in action. Source: https://ethglobal.com/events/cannes2026/info/details

INFERRED Lisbon build:
- [medium] Build an event-native marketplace for verified participation: attendees prove they completed a workshop, mentoring session, demo review, or community task, then unlock voting, matching, grants, or collectibles.
- [medium] Sponsor fit: World or NFC/signature proof for uniqueness, ENS for attendee/project profiles, The Graph for rankings/querying, and Hedera for low-cost participation records.
- [medium] Demo: scan/prove attendance, mint or write a participation record, cast one verified vote, and show a public leaderboard that rejects duplicate participation.
- [medium] Risk: avoid a souvenir app. The proof must unlock a scarce action: vote, allocation, intro, grant, or access.

## Thesis 8: Agent reputation index for Lisbon submissions

EXTRACTED anchor facts:
- [high] AgentIndex won ENS New York 2026 2nd place for agent identity/reputation intelligence using ERC-8004 history, ENS enrichment, BigQuery ingest, anomaly flags, and sybil signals. Source: https://ethglobal.com/showcase/agentindex-psxxo
- [high] Agentbook.eth built a searchable identity/reputation network for agents and professionals with ENS, Hedera credentials, and Google-powered scoring. Source: https://ethglobal.com/showcase/agentbook-eth-qwix7
- [high] ENS New York criteria explicitly call for agent names, metadata, subname registries, and discoverability. Source: https://ethglobal.com/events/newyork2026/prizes

INFERRED Lisbon build:
- [medium] Build a live reputation index for agents used by hackathon teams: agent name, owner, tools, payment endpoints, completed tasks, reviews, disputes, and trust score. Make it agent-callable through MCP as well as human-readable.
- [medium] Sponsor fit: ENS for names/text records, Hedera for reputation events or credentials, The Graph for indexing/querying, World for human-backed agents, and 0G if agent evaluations are decentralized.
- [medium] Demo: register two agents, make one complete paid work and one fail a task, write both outcomes, then query "which Lisbon research agents are trustworthy?" through the UI and MCP.
- [medium] Risk: reputation without transactions is weak. Include at least one live payment or task outcome.

## Prioritized shortlist

INFERRED reasoning:
- [medium] Highest expected Lisbon ROI under the visible sponsor board: Thesis 1 (Human-backed agent free-trial router), Thesis 4 (Net-risk DeFi copilot), Thesis 5 (Open-source dependency trust registry), and Thesis 8 (Agent reputation index). These map cleanly to World, ENS, 0G, The Graph, Hedera, Uniswap, and 1inch.
- [medium] Highest wow factor: Thesis 6 (Attested private node marketplace) and Thesis 7 (Proof-of-participation event market), but both are execution-riskier because they depend on hardware/TEE/event logistics.
- [medium] Highest continuity-track fit: Thesis 3 (Private programmable payroll), Thesis 4 (Net-risk DeFi copilot), and Thesis 8 (Agent reputation index), because they benefit from an existing codebase and a clear "new feature shipped during Lisbon" narrative.
- [medium] Best "only build if tracks fit" candidates: Thesis 2 and Thesis 3. They are strong historically, but their cleanest Cannes/New York sponsor rails were Arc/Circle/Chainlink/Canton, which are not visible on the current official Lisbon prize page.

## Gaps to close when detailed Lisbon tracks are live

EXTRACTED facts:
- [high] Lisbon 2026 visible partners and headline prize amounts are confirmed on the official ETHGlobal prize page. Source: https://ethglobal.com/events/lisbon2026/prizes
- [medium] Detailed partner-specific tracks, qualification requirements, and judging rubrics were not visible in the official ETHGlobal pages reviewed in this slice.

INFERRED next checks:
- [medium] Re-rank ideas after confirming partner-specific tracks, continuity-track categories, demo requirements, and any sponsor-specific mandatory forms or booth-presentation requirements.
- [medium] For any selected thesis, produce a one-page sponsor matrix before building: primary prize, secondary prizes, required artifacts, exact SDK/API usage, required tx/proof, demo script, and fallback path if a sponsor service is unstable.
