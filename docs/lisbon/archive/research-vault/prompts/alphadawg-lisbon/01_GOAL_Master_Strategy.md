---
title: GOAL AlphaDawg Lisbon Master Strategy
aliases:
  - AlphaDawg Lisbon Master Goal
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - prompt/goal
  - strategy
status: ready
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# GOAL — AlphaDawg Lisbon Master Strategy

## Copy/Paste Prompt

````text
/goal

Objective

Create the evidence-backed, engineering-ready master strategy for continuing AlphaDawg at ETHGlobal Lisbon 2026. Deeply audit the current Cannes project, revalidate every live Lisbon prize and rule, identify the highest-value coherent three-partner portfolio, and produce a prioritized plan for turning AlphaDawg from a hard-coded OpenClaw-era trading swarm into a low-cost, open agent-commerce product and reusable infrastructure layer.

Optimize for risk-adjusted prize value and judge-verifiable execution, not for the largest raw sum of bounty pools or the greatest number of superficial integrations.

Workspace

- Research vault: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault
- AlphaDawg repository: https://github.com/elbarroca/ETH_Global_Cannes_2026
- Current audited checkout, if still present: /tmp/ETH_Global_Cannes_2026-019f6a69
- Lisbon prizes: https://ethglobal.com/events/lisbon2026/prizes
- ETHGlobal rules: https://ethglobal.com/rules
- Current Cannes baseline SHA: bfa7bd37c573e2e49525d965f7f937210e170d72

Operating mode

- Work autonomously until all non-blocked completion gates pass.
- Use parallel subagents for independent bounded work when available: repository architecture audit, official track/rules research, winner/technology research, and end-to-end engineering planning. The main agent must reconcile their evidence and own the final decisions.
- Browse current primary sources. Do not rely on cached prize text, search snippets, old vault claims, or memory for time-sensitive facts.
- Read the repository and its AGENTS.md before proposing files, symbols, dependencies, or commands.
- If .codegraph exists, use CodeGraph for structural questions; otherwise use rg.
- Never expose secrets. Do not spend money, deploy to mainnet, message organizers, or make external submissions without explicit authorization.
- Do not implement product code in this strategy goal. Produce decision-ready research and engineering contracts first.

Starting facts to verify, not blindly assume

- AlphaDawg won Cannes prizes in Hedera and 0G and is entering Lisbon as a disclosed Continuity project.
- A different second team member may join in Lisbon. Team-change eligibility and the former contributor's IP rights must be treated as gates.
- New York evidence shows Continuity projects can win other partner prizes, but ETHGlobal's official rule says partner-prize eligibility may vary. The working premise is that AlphaDawg may apply to regular partner tracks; every partner-specific claim still needs current written or official-page support.
- ETHGlobal limits the submission to three sponsor integrations/partners. Reverify the exact current wording.
- Current execution scope is 0G, Hedera, and Uniswap Foundation. Research all eight Lisbon partners, but do not add 1inch or Sui to the build scope without a new user decision. ENS, The Graph, and World are research-only unless the final EV analysis proves they should replace one of the three current partners and the user approves the scope change.
- OpenClaw was a Cannes-specific 0G prize surface. Lisbon's 0G prizes focus on AI Product, Infrastructure & Tooling, and Keep Building. OpenClaw may remain an optional Hedera tool, but it is not the product thesis.
- Preserve Arc x402 $0.001 nanopayments as a working legacy/basic path. Arc is not a Lisbon target partner, and Arc or MockSwapRouter transactions cannot count as Lisbon sponsor evidence.

Phase 1 — Establish the exact baseline

1. Confirm local and remote HEAD and record the immutable Cannes baseline.
2. Inspect commit history, contributors, license status, project-level instructions, package versions, deployments, contracts, database schema, APIs, agent runtime, payment rails, 0G integrations, Hedera integrations, Arc x402 flow, marketplace, reputation, execution, UI, and validation scripts.
3. Trace the real end-to-end flow from user intent through agent selection, specialist execution, proof, payment, debate, trade, persistence, and UI evidence.
4. Separate working code from mocks, fallbacks, claims, comments, stale documentation, and disconnected paths.
5. Produce a file-and-symbol evidence table for every material finding.
6. Explicitly audit these known risk areas:
   - static src/config/agent-registry.ts and src/agents/role-manifests.ts
   - hard-coded $0.001 price and fixed specialist prompts/data paths
   - placeholder local://user-created onboarding and DB-only hire paths
   - disconnected registries and API method mismatches
   - missing typed task/RFQ/quote/award/delivery/settlement state
   - shared mnemonic-derived provider wallets
   - OpenClaw types, gateway probes, workspaces, Fly deployment, and 0G metadata coupling
   - fail-open proof/inference behavior and proof propagation
   - local-only ELO/reputation
   - MockSwapRouter or self-transfer fallbacks
   - forced BUY post-processing
   - missing standard test script
   - missing license and contributor/IP approval

Phase 2 — Revalidate Lisbon and Continuity

1. Enumerate every currently visible partner, track, payout, winner count, category label, qualification requirement, mandatory SDK/API, deployment requirement, demo limit, feedback/form requirement, and ambiguity.
2. Use official ETHGlobal and sponsor pages first. Record URL, access timestamp, source quality, and a short supporting excerpt or precise paraphrase.
3. Compare official rules with New York Continuity outcomes. Separate:
   - confirmed rule
   - demonstrated precedent
   - sponsor-specific ambiguity
   - team assumption
4. Build a partner eligibility matrix for the unchanged AlphaDawg baseline plus new Lisbon-only code.
5. Treat the following as the initial target portfolio, subject to live verification:
   - 0G: Best AI Product; Best Infrastructure & Tooling; Keep Building on 0G
   - Hedera: AI & Agentic Payments; Tokenization; Cross-Chain Automation Hub
   - Uniswap Foundation: Best Uniswap API Integration; Best Uniswap Stack Contribution
6. Treat Hedera No Solidity as incompatible unless Hedera gives an explicit ruling that the submitted project can be scoped to an isolated SDK-only module despite the pre-existing Solidity and destination-chain contracts. Do not count it in expected value before that ruling.
7. Flag any apparent conflict inside sponsor copy, especially Tokenization wording versus its qualification requirements.

Phase 3 — Current technology radar

Research only technologies that could materially improve sponsor fit, novelty, correctness, cost, or demo strength. Use current specifications and official repositories/docs. At minimum evaluate:

- A2A: current stable specification, Agent Cards, task lifecycle, authentication, streaming, and minimum interoperable server surface.
- x402: current recommended version, server/client packages, CAIP-2 identifiers, facilitator choices, replay/idempotency, and migration from the current implementation.
- ERC-8004: current status, identity/reputation/validation registries, A2A/x402 interoperability, and the risk of depending on a draft.
- ERC-8183 or the current agentic-commerce equivalent: maturity, overlap with AlphaDawg's job lifecycle, and whether it is buildable in 36 hours.
- Hedera Agent Kit, HCS/HCS-14, HTS, Schedule Service, Mirror Node, UCP, and Axelar GMP.
- 0G Compute/Private Computer, sealed inference, Storage, Chain, and Agentic ID.
- Uniswap Developer Platform APIs, current quote route union, approvals, Permit2, swap/order execution, status polling, UniswapX changes, chained routing, and uniswap-ai.

For every candidate, score sponsor relevance, maturity, integration cost, operating cost, novelty, judge visibility, failure risk, and whether it strengthens the single core demo. Reject protocol tourism and bolt-on features.

Phase 4 — Select the product and prize portfolio

Define one coherent product narrative:

AlphaDawg becomes an open, proof-carrying Agent Commerce Kit. External agents publish discoverable capabilities, compete with signed variable-price quotes, deliver 0G-verifiable work, receive exactly one settlement, and can produce a policy-bounded Uniswap execution. AlphaDawg remains the end-user reference product.

Use this common vertical slice:

register -> discover -> request -> quote -> award -> deliver -> verify -> settle -> execute -> score

Score every target track using a transparent model:

- eligibility confidence
- maximum obtainable prize for one placement, not the whole pool
- probability of completing the qualifying path
- judge/product fit
- incremental engineering cost
- overlap with the common vertical slice
- dependency and live-demo risk
- likely competitive density, with uncertainty clearly stated

Do not manufacture precise win probabilities. Provide minimalist, recommended, and maximal portfolios with explicit assumptions and cut rules. Distinguish theoretical ceiling, credible ceiling, risk-adjusted planning value, and confirmed Continuity-only value.

Phase 5 — Design the Lisbon delta

Specify a low-cost server-agent architecture that removes OpenClaw as a required runtime without rewriting working sponsor code unnecessarily:

- one orchestrator/API service plus one external-provider example, not one VM per agent
- multi-agent routing behind one host where appropriate
- discoverable Agent Cards instead of source-code registry edits
- typed task, quote, award, delivery, proof, settlement, execution, and feedback records
- independent provider identities and settlement accounts
- transport, proof, payment, and execution adapters
- 0G sealed inference and Storage retained as the verifiable intelligence/memory layer
- Arc x402 retained as the legacy built-in-specialist rail
- Hedera as the new negotiated settlement/audit rail if eligible
- Uniswap as the real verified-intent execution adapter
- strict fail-closed verification, idempotency, replay protection, budgets, timeouts, and observable receipts

Define what OpenClaw assets are retained, adapted, deprecated, or removed. Do not delete the old path until the replacement passes parity and failure-path tests.

Phase 6 — Produce the controlling artifacts

Create or update these vault notes:

- strategy/alphadawg/09_Lisbon_Live_Track_and_Eligibility_Audit.md
- strategy/alphadawg/10_AlphaDawg_Current_Engineering_Audit.md
- strategy/alphadawg/11_Server_Agent_Target_Architecture.md
- strategy/alphadawg/12_Prize_Weighted_Sprint_Backlog.md
- strategy/alphadawg/13_E2E_and_Submission_Evidence_Plan.md

Update strategy/alphadawg/00_Command_Center.md only after the new evidence is reconciled. Mark superseded claims rather than silently overwriting history.

The final package must contain:

- executive build decision
- exact baseline and current-state architecture
- confirmed facts versus assumptions
- full Lisbon track ledger
- Continuity/team/IP eligibility matrix
- current technology radar with BUILD / WATCH / REJECT decisions
- minimalist, recommended, and maximal prize portfolios
- track-to-feature-to-file-to-test-to-demo mapping
- target architecture and migration sequence
- 36-hour backlog with dependencies, owner lanes, hour gates, and cut line
- operating-cost budget and low-cost deployment topology
- end-to-end success and failure tests
- submission evidence checklist
- organizer questions that require external authority
- explicit BUILD / NARROW / STOP contract

Success criteria

1. Every live prize or eligibility claim has a current primary source and access date.
2. Every current-state engineering claim has repository file/symbol evidence.
3. The target portfolio respects the current three-partner limit and user exclusions.
4. One common vertical slice supports every recommended track without contradictory architecture.
5. OpenClaw migration preserves the 0G/Arc value that still matters and materially lowers deployment/runtime complexity.
6. The plan distinguishes real testnet/onchain evidence from mocks and fallbacks.
7. The sprint has measurable pass/fail gates and a credible cut line.
8. A future implementation agent can work from the artifacts without guessing product scope, APIs, state transitions, or verification requirements.
9. Run the vault QA checks for Markdown parsing, frontmatter, source URLs, access dates, and wikilinks. Record the results.

Stop rules

- Official current partner rules override prior assumptions and New York precedent.
- Do not claim regular-track eligibility merely because Continuity projects previously won elsewhere.
- Do not target Hedera No Solidity without a written interpretation resolving the whole-project conflict.
- Do not expand to 1inch, Sui, ENS, The Graph, or World without an explicit scope decision.
- Do not count mocks, local forks where disallowed, self-transfers, old Cannes transactions, or fallback success as Lisbon sponsor evidence.
- Do not count multiple placements from one prize pool as simultaneously obtainable by one team unless the sponsor explicitly permits it.
- Do not recommend an integration that cannot be shown end to end within the demo time limit.
- If team/IP/Continuity authorization is unresolved, mark submission readiness BLOCKED but continue all safe internal research and planning.
- If a source is unavailable or contradictory, preserve the ambiguity and draft the shortest organizer question; never guess.

Final response

Return the build decision, recommended portfolio, top five engineering priorities, critical blockers, exact artifact paths, QA results, and the next executable goal. Keep the response concise; the vault is the full source of truth.
````

