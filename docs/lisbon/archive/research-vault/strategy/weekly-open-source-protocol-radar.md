# Weekly Open Source Protocol Radar

Automation: `ETHGlobal protocol radar`

Cadence: weekly local Codex automation in this repo.

## Job

Research current open-source crypto protocols, SDKs, standards, and developer primitives that can materially improve ETHGlobal Lisbon ideation. Prioritize official docs, GitHub repos, EIPs/ENSIPs, and protocol foundation posts.

## Current Watchlist

| protocol | strongest Lisbon angle | build wedge |
|---|---|---|
| World AgentKit | Human-backed agents | Verified human delegates proof to an agent; app enforces quota, access, or reputation. |
| x402 | Agent/API payments | Payment-gated APIs, agent services, paid data enrichment, dispute-friendly machine commerce. |
| ERC-8004 | Agent identity and reputation | ENS-named agents with registry history, reputation, and service endpoints. |
| Uniswap v4 hooks | Programmable liquidity | LP/routing hooks that encode safety, fees, compliance, or risk constraints. |
| The Graph Substreams | Fast indexing | Trust dashboards for agents, hooks, payments, and human-verification activity. |
| 0G | Verifiable AI infrastructure | Agent memory, inference receipts, decentralized compute/storage for AI workflows. |
| ENSv2 and ENS docs | Identity/discovery | Names for agents, services, trust artifacts, product passports, and policy records. |
| 1inch Aqua | Shared liquidity | Capital allocation and routing strategies that reduce fragmentation or expose risk. |
| Yellow state channels | Offchain clearing | Fast agent trades, service clearing, net settlement, and low-latency games. |
| Hedera/Hiero | Audit and no-Solidity services | Consensus logs, scheduled actions, tokenized product passports, payment automation. |
| Chainlink CRE privacy | Confidential workflows | Private compliance, confidential attestation, institutional DeFi policy checks. |
| Walrus | Verifiable data | Durable evidence blobs, media/data availability, and portable agent memory. |
| ENSIP-25 and ENSIP-26 | Agent discovery records | ENS text records for agent endpoints, verification methods, and interaction metadata. |
| ERC-4337 plus EIP-7702 | Safer delegated wallets | Smart-account flows, delegated EOAs, sponsorship, batching, and constrained agent execution. |
| ERC-7683 | Cross-chain intents | Standardized intent orders for solver-based cross-chain routing and settlement. |
| Semaphore | Private membership proofs | Anonymous group membership, voting, endorsements, and gated access. |
| Sui zkLogin | Wallet onboarding | OAuth-backed self-custodial login and transaction authorization on Sui. |
| Open Intents Framework | Cross-chain intent infrastructure | Reusable contracts, solver, aggregator, and specs for ERC-7683-style intent products. |
| ERC-7579 | Modular smart accounts | Portable wallet modules for session keys, policy guards, recovery, and agent permissions. |
| ERC-7715 | Wallet permissions | Scoped execution permissions for pre-authorized agent, subscription, and DeFi actions. |
| Ethereum Attestation Service | Attestation substrate | Open schemas and attestations for reputation, compliance receipts, and product claims. |
| Circle CCTP | Cross-chain USDC movement | Native burn-and-mint USDC transfers with fast transfer and hook surfaces. |
| The Compact | Resource locks | Reusable commitments for asynchronous cross-chain fills, claims, arbiters, and escrow. |
| EigenDA | Data availability | Ethereum-aligned DA for rollup data, large evidence blobs, and agent audit trails. |

## Opportunity Theses

1. Human-backed agent commerce is the strongest cross-track wedge.
Combine World AgentKit, x402, ENS/ERC-8004, and The Graph. The product should answer: who is the agent acting for, what can it buy, what happens if the service fails, and how is reputation updated?

2. DeFi tools need decision metrics, not another dashboard.
Carry is the pattern: expose a hidden cost and turn it into an immediate recommendation. For Lisbon, target LVR, hook risk, route quality, shared-liquidity utilization, or liquidation/privacy risk.

3. Privacy/compliance should decide a transaction.
OpenCompliance, SENTINEL, and Nyx point to a strong shape: confidential checks that allow, block, price, or route a transfer/trade. A demo that ends in a policy decision is stronger than a privacy architecture diagram.

4. Agent safety needs constrained execution.
ENShell, maki, Better Wallet, and Veryclear all convert unsafe signing into a policy/simulation/clear-signing loop. A Lisbon version should support an agent action, simulate it, explain it, enforce a rule, and record why it was approved or blocked.

5. Event-local apps only matter when the event becomes a proof source.
PaintGlobal and Scoutxyz show the right direction: use physical presence, verified attendance, or local interactions to create a scarce signal. Avoid event-branded apps with no proof or transaction.

## Reviewed Synthesis - 2026-06-29

### Extracted facts

- ENSIP-25 and ENSIP-26 are official ENS improvement proposals for agent-relevant text records, including verification and service-discovery metadata.
- ERC-4337 and EIP-7702 are Ethereum standards for account abstraction and delegated account behavior; `eth-infinitism/account-abstraction` remains the reference open-source implementation surface.
- ERC-7683 standardizes cross-chain intent order handling; Across documents it as a production concept for its cross-chain intent flow.
- Semaphore is an open-source zero-knowledge protocol for anonymous group membership proofs.
- Sui zkLogin is documented by Sui as an OAuth-backed self-custodial login primitive; the Sui codebase is public on GitHub.

### Inferred ideation opportunities

- Combine ENSIP agent records with ERC-8004 and x402 to make agent endpoints discoverable, payable, and reputationally inspectable.
- Build wallet-security products around constrained delegated execution: EIP-7702/4337 policy wallets, session-key limits, paymaster onboarding, and post-action audit trails.
- Use ERC-7683 as a judge-visible DeFi primitive: compare solver routes, settlement guarantees, fees, failure modes, and liquidity source quality.
- Use Semaphore when World proof is too identifying or too centralized for the product: anonymous attendee voting, private access proofs, and unlinkable human endorsements.
- Use Sui zkLogin for consumer demos where seed phrases would kill the workflow; pair it with explicit transaction previews and sponsored actions.

## Reviewed Synthesis - 2026-07-06

### Extracted facts

- Open Intents Framework documents a full-stack cross-chain intents framework with contracts and solver components, and its public GitHub organization contains contracts, solver, aggregator, specs, and support repos.
- ERC-7579 defines minimal interfaces and behavior for modular smart accounts and modules so modules can interoperate across account implementations.
- ERC-7715 defines wallet execution-permission request structures, including permission and rule objects such as expiry rules.
- Ethereum Attestation Service publishes open-source contracts and SDKs for onchain/offchain attestations, schemas, resolvers, and developer integration.
- Circle documents CCTP as permissionless native USDC burn-and-mint cross-chain transfer infrastructure; current CCTP docs include fast transfer and hooks, and Circle maintains public EVM CCTP contracts.
- Uniswap The Compact is an ownerless ERC6909 resource-lock contract with developer docs and an MIT-licensed public repository.
- EigenDA is documented as an EigenLayer-based data availability protocol live on Mainnet/Sepolia testnet, with a public Layr-Labs repo.

### Inferred ideation opportunities

- Build cross-chain intent demos on OIF plus The Compact instead of hand-rolling solver, escrow, and settlement primitives.
- Treat ERC-7579 and ERC-7715 as the wallet safety layer for x402 or agent commerce: show exactly what an agent can spend, when permission expires, and how revocation works.
- Use EAS as the shared evidence layer for agent reputation, compliance decisions, project passports, and verified builder credentials, then index those claims with The Graph.
- Use CCTP for payment movement in agent commerce demos where the user experience depends on native USDC arriving on the destination chain.
- Use EigenDA for evidence-heavy demos where judge-visible value comes from durable availability of attestations, logs, prompts, or rollup data rather than another storage upload screen.

## Automation Output Contract

Every run should update:
- `registers/open_source_protocol_watchlist.csv`
- `strategy/weekly-open-source-protocol-radar.md`
- `03_Source_Ledger.md`
- `registers/source_freshness.csv`

Every new protocol row should include:
- source URLs
- access date
- whether it is open source, open standard, or merely official docs
- a Lisbon build angle
- matching sponsor surfaces
- recheck date before the hackathon

## Source Rules

- Prefer official docs, GitHub repos, EIPs/ENSIPs, and protocol foundation blogs.
- Use media sources only for dates, launches, or ecosystem context.
- Do not treat protocol marketing claims as production guarantees.
- Keep extracted facts separate from inferred build opportunities.
