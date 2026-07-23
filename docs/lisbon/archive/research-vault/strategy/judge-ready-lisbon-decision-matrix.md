# Judge-Ready Lisbon Decision Matrix

> Historical general-purpose matrix. For AlphaDawg and the refreshed 2026-07-16 prize surface, use [[alphadawg-lisbon-continuity-strategy]].

Access baseline: 2026-06-22  
Local verification date: 2026-06-23  
Status: strategy file for hackathon planning, not external claims deck.

Source stance:
- Facts come from the vault registers, official ETHGlobal/event/showcase URLs already captured in the vault, and the ETHGlobal New York rule page rechecked on 2026-06-23.
- "Why it won" is inference, not jury intent.
- Repo setup, sponsor SDK usage, and demo reproducibility are marked `unknown` unless the vault already audited implementation details.
- Confidence labels: high = direct official/project-page support; medium = official signal plus incomplete detail; low = unresolved or social/index-only.

Unresolved source gaps:
- Lisbon prize requirements can change before July 24, 2026. Current vault baseline is 2026-06-22; recheck the official Lisbon prize page before final team selection.
- ALMA has finalist-list evidence only; project-page enrichment remains unresolved.
- New York overall finalist project details remain unresolved for Canary, Accrue, Void Tactics, LYNX, Distro, UNSU, update, Proof of Scan, The Wallet Shift, Immunity, and Cumulant.
- AgentRanker vs AgentRankr award mapping conflicts across vault files; reconcile before using either as exact Hedera/ENS award evidence.
- Team members are unresolved in `registers/project_repos_teams.csv`; do not invent them.
- Repo implementation/setup details are not audited in this pass. In `project_repos_teams.csv`, live demo URLs usually equal repo URLs; do not treat them as deployed demos.

## 1. Executive Decision

Build these first.

| rank | idea | one-line product | matched sponsor tracks | repo/open-source angle | why it can win | biggest risk | 36-hour MVP | proof artifact | demo moment | score /100 | confidence |
|---:|---|---|---|---|---|---|---|---|---|---:|---|
| 1 | Human-backed x402 service desk | Agent pays for one service; a World-verified human backs execution; disputes update public reputation. | World; ENS; The Graph; Yellow | Extend an x402/MCP service or agent-registry repo with World proof, ENS service record, indexed outcomes, and a dispute state. | Combines Proof-of-Human, Clawback, DIVE, and AgentIndex patterns: identity, payment, failure handling, and reputation all change the product outcome. | Scope creep into a full marketplace; Yellow details need recheck. | One paid endpoint, one human proof, one task result, one dispute/refund path, one reputation update. | World proof/nullifier, x402 receipt, ENS text record, indexed reputation row. | Buyer disputes a failed paid task; escrow/reputation changes live. | 90 | high |
| 2 | Prompt-injection firewall for agent wallets | Agent proposes a transaction; policy/simulation blocks malicious prompt-injected signing before funds move. | ENS; 0G; Hedera; The Graph | Extend an agent wallet or MCP action repo with ENS agent identity, 0G reasoning/memory receipt, Hedera audit log, and indexed policy events. | ENShell, maki, Better Wallet, and Veryclear show wallet/agent safety is judge-legible and demoable in one before/after loop. | Security claims can overreach; scope must be one protected transaction type. | One swap/transfer action, one malicious prompt, classifier/policy check, block/allow result, audit log. | Blocked action trace, policy hash, agent identity record, indexed event. | Same agent request succeeds when safe and is blocked when prompt-injected. | 86 | high |
| 3 | LVR-aware Aqua/Uniswap allocator | LP sees true net return after LVR and gets one recommended action: hold, tighten, widen, or route to Aqua. | 1inch; Uniswap Foundation; The Graph | Extend a DeFi dashboard/indexer with Uniswap/Aqua strategy scoring and a public calculation module. | Carry and Ballast show DeFi tools win when hidden risk becomes a concrete decision metric, not a vanity dashboard. | Math/data quality; avoid pretending to be full portfolio management. | Two pools, one wallet/position input, LVR estimate, strategy comparison, simulated execution. | Reproducible score table, pool data, recommended range/route, simulation output. | Headline APR flips from "good" to "bad" after LVR, then app recommends one action. | 85 | high |

Backup:
- Human-backed agent marketplace reputation: strong pattern, but broader than the service-desk version.
- Verifiable agent memory and audit trail: useful if tied to a spending/approval/ranking decision.

Reject for current build:
- Private pay-per-use data/API access: too generic without a sharper paid service and dispute loop.
- Private compliance router in Chainlink-first form: strong historical pattern, but Chainlink is not confirmed as a Lisbon prize partner in the current vault baseline.

## 2. Finalist vs Track Winner Logic

### Extracted Winner/Finalist Snapshot

| event | overall finalist evidence | track/sponsor winner evidence | confidence | source rows |
|---|---|---|---|---|
| Cannes 2026 | ENShell, DIVE, maki, Defi, ALMA, npmguard, VEIL VPN, PaintGlobal, EVM PORST, Corpus | DIVE, VEIL VPN, ENShell, npmguard, OpenCompliance, SENTINEL, Shawarma Orchestrate, Veryclear | high except ALMA low | `registers/projects.csv`, `registers/winner_reasoning.csv` |
| New York 2026 | Canary, Accrue, Void Tactics, LYNX, Distro, UNSU, update, Proof of Scan, The Wallet Shift, Immunity, Cumulant are listed as finalist signal but not enriched | Proof-of-Human, Nyx, AgentRanker, AgentIndex, AgentRankr, Azimuth, Clawback, Better Wallet, Ballast, Smile, Kickoff Aivy Studio, ENSFromWei, Tap Tap Revolution, Preo | medium for unresolved rows; high/medium for enriched rows | `registers/projects.csv`, `registers/winner_reasoning.csv` |

### Decision Logic

| type | what it means | what judges see | examples | Lisbon implication |
|---|---|---|---|---|
| Overall finalist | Strong total project across product, originality, technicality, usability, practicality, and wow. | Clear pain, complete live loop, inspectable proof, memorable result. | [[projects/dive]], [[projects/veil-vpn]], [[projects/enshell]], [[projects/maki]], [[projects/evm-porst]] | Build a full product loop, not just sponsor compliance. |
| Track winner | Sponsor-native fit. The sponsor primitive is necessary to the product. | Removing the sponsor breaks the outcome. | [[projects/proof-of-human]], [[projects/opencompliance]], [[projects/agentindex]], [[projects/better-wallet]], [[projects/ballast]] | Pick tracks where the primitive is in the critical path. |
| Multi-track winner | Several sponsors each do a different required job. | Identity, compute, storage, settlement, indexing, and proof are separable and causal. | [[projects/dive]], [[projects/veil-vpn]], [[projects/azimuth]] | Use multiple sponsors only when each has a separate job. |
| Strong pattern, not confirmed winner | Useful evidence for product shape, not prize proof. | The demo teaches a reusable wedge. | [[projects/carry]], [[projects/scoutxyz]] | Use as design input, not as winner evidence. |

Fact:
- New York 2026 introduced a repo rule change: builders may bring existing code and choose From Scratch, Extend Open Source, or Ship a Feature.

Inference:
- Lisbon strategy should favor visible open-source feature deltas over greenfield app shells because judges and sponsors can inspect what changed.

## 3. Winner Pattern Extraction

| pattern | examples | why it worked | Lisbon transfer | anti-pattern | confidence |
|---|---|---|---|---|---|
| Human-backed agents | [[projects/dive]], [[projects/proof-of-human]], [[projects/scoutxyz]] | Personhood is a constraint, not login; it limits eligibility, rate, fairness, or accountability. | World-backed service agent with ENS identity and indexed history. | World ID as login only. | high |
| Agent payments and disputes | [[projects/clawback]], [[projects/veil-vpn]], [[projects/scoutxyz]] | Payment is paired with receipts, refunds, or reputation. | x402 paid service desk with dispute state and reputation update. | Payment gate with no refund or failure path. | high |
| Wallet/transaction safety | [[projects/enshell]], [[projects/maki]], [[projects/better-wallet]], [[projects/veryclear]] | Unsafe action is visible, then blocked or explained. | Agent-wallet firewall for one transaction type. | AI wallet copilot with no deterministic guard. | high |
| Private/compliant DeFi | [[projects/opencompliance]], [[projects/sentinel]], [[projects/nyx]] | Privacy protects a concrete trade, transfer, risk score, or settlement decision. | Private policy result that allows/blocks one DeFi action. | Privacy proof without a transaction outcome. | medium |
| DeFi risk/liquidity intelligence | [[projects/carry]], [[projects/ballast]], [[projects/smile]], [[projects/nyx]] | Hidden financial risk becomes a decision metric. | LVR-aware Uniswap/Aqua allocator with one recommendation. | Dashboard with no action. | high |
| Indexing/reputation | [[projects/agentindex]], [[projects/agentranker]], [[projects/agentrankr]], [[projects/npmguard]] | Trust artifact is discoverable, explainable, and tied to routing. | ENS + The Graph agent/service reputation index. | Opaque score with no next action. | high |
| Event-local proof | [[projects/paintglobal]], [[projects/scoutxyz]] | Local context creates a hard-to-fake proof or matching signal. | Lisbon attendee proof only if it changes access, ranking, or payment. | Event branding with no proof. | medium |
| Open-source feature extensions | New York rule change; [[projects/better-wallet]], [[projects/agentindex]], [[projects/carry]] as repo candidates | Existing code makes the hackathon diff legible and credible. | Add one sponsor-native feature to a useful open-source repo. | New platform from scratch when a repo already gives leverage. | high |

Note: treat AgentRanker/AgentRankr as an unresolved mapping pair until official prize detail is reconciled.

## 4. Open-Source Rule Strategy

New York 2026 rule change:
- From Scratch: empty repo remains allowed.
- Extend Open Source: bring a repo already maintained and ship a feature.
- Ship a Feature: build a feature on top of an existing product and ship it as open source.
- Official rule page says `starting_point: any repo you bring` and `existing_code: welcomed`.

Lisbon strategy change:
- The build should show a visible public diff, not just a demo.
- Sponsor primitives should appear in the changed code path.
- Repo setup must be boring enough to survive judging.
- The proof artifact should be inspectable from the app and the repo.

Repo approach ranking:

| rank | approach | use when | why |
|---:|---|---|---|
| 1 | Extend useful open-source repo with sponsor-native feature | The repo already has a real user workflow and the feature can ship in 36 hours. | Highest credibility: before/after diff plus working product. |
| 2 | Fork prior ETHGlobal repo and add a Lisbon-specific primitive | The old project maps cleanly to World, ENS, The Graph, Hedera, 0G, 1inch, Uniswap, or Yellow. | Fast path to a replayable loop, but needs visible new delta. |
| 3 | Build from scratch | No repo gives leverage or setup risk is worse than greenfield. | Accept only for small primitives, demos, or hard-to-integrate ideas. |

## 5. Repo Diligence Matrix

Scoring note: this is a pre-audit planning score. Because repo setup, SDK usage, and reproducibility were not audited, scores are capped at 40/50 unless a row has no repo.

| repo URL | project | event | setup likely | sponsor SDK visible | demo reproducible | Lisbon extension potential | risk | score /50 |
|---|---|---|---|---|---|---|---|---:|
| https://github.com/scryptedai/agentindex | AgentIndex | New York 2026 | unknown | unknown | unknown | Excellent for ENS + The Graph agent reputation. | Unknown setup; scoring must be explainable. | 40 |
| https://github.com/ben-harper27/ethglobal-nyc-26 | Carry | New York 2026 | unknown | unknown | unknown | Excellent for Uniswap/1inch risk score extension. | Math/data quality. | 39 |
| https://github.com/EdwardJXLi/Clawback | Clawback | New York 2026 | unknown | unknown | unknown | Excellent for x402 dispute/refund service desk. | Sponsor reconciliation unresolved. | 38 |
| https://github.com/zambrose/agentrank | AgentRankr | New York 2026 | unknown | unknown | unknown | Strong for agent trust, ENS, Hedera, The Graph. | Potential duplicate with AgentIndex. | 38 |
| https://github.com/Hitakshi02/AgentRank | AgentRanker | New York 2026 | unknown | unknown | unknown | Strong for agent reputation with Hedera/The Graph. | Unknown implementation depth. | 37 |
| https://github.com/0xenshell/contract | ENShell | Cannes 2026 | unknown | unknown | unknown | Strong base for prompt-injection firewall. | May be contract-only; frontend/demo unknown. | 36 |
| https://github.com/JackREscowitz/Proof-Of-Human-Drops | Proof-of-Human | New York 2026 | unknown | unknown | unknown | Strong World proof constraint pattern. | Drop/raffle may be less Lisbon-specific. | 36 |
| https://github.com/mcmoodoo/Ballast | Ballast | New York 2026 | unknown | unknown | unknown | Strong 1inch Aqua/Liquidity strategy angle. | Needs careful financial explanation. | 35 |
| https://github.com/derek2403/cannes2026 | DIVE | Cannes 2026 | unknown | unknown | unknown | Strong human-backed agents, 0G, Hedera, World. | Broad product, higher integration load. | 35 |
| https://github.com/itublockchain/veil-vpn | VEIL VPN | Cannes 2026 | unknown | unknown | unknown | Strong pay-per-use proof-service pattern. | VPN/TEE scope too large for Lisbon delta. | 34 |
| https://github.com/kryczkal/EthCannes2026 | npmguard | Cannes 2026 | unknown | unknown | unknown | Strong ENS trust-registry pattern. | Package-security domain may drift from Lisbon sponsors. | 34 |
| https://github.com/slaviquee/maki | maki | Cannes 2026 | unknown | unknown | unknown | Strong bounded DeFi agent/wallet safety base. | Hardware/signing dependencies unknown. | 33 |
| https://github.com/JuampiHernandez/scout-networking-agents | Scoutxyz | New York 2026 | unknown | unknown | unknown | Good event-local agent commerce pattern. | Event-networking can become soft. | 33 |
| https://github.com/vaibhav-vemula/azimuth | Azimuth | New York 2026 | unknown | unknown | unknown | Good multi-sponsor identity/storage/automation memory base. | Too many moving parts. | 32 |
| https://github.com/chevoisiatesalvati/schwarma-orchestrator | Shawarma Orchestrate | Cannes 2026 | unknown | unknown | unknown | Good 0G DeFi-agent orchestration pattern. | DeFi agent scope can sprawl. | 32 |
| https://github.com/BetterWallet/betterwallet-nfc | Better Wallet | New York 2026 | unknown | unknown | unknown | Good wallet safety and clear-signing base. | Hardware dependency. | 31 |
| https://github.com/lfglabs-dev/explain.md | Veryclear | Cannes 2026 | unknown | unknown | unknown | Good transaction explanation primitive. | May need product wrapper. | 31 |
| https://github.com/ybapat/ethny26 | Nyx | New York 2026 | unknown | unknown | unknown | Good private DeFi inspiration. | RWA/privacy stack may not fit Lisbon sponsors. | 29 |
| https://github.com/fraVlaca/open-compliance-network | OpenCompliance | Cannes 2026 | unknown | unknown | unknown | Good compliance-router pattern. | Chainlink-first sponsor gap for Lisbon. | 29 |
| https://github.com/Ayoub-ouederni/SENTINEL | SENTINEL | Cannes 2026 | unknown | unknown | unknown | Good risk-score-to-decision pattern. | TEE/compliance infra complexity. | 28 |
| https://github.com/oslinin/Smile | Smile | New York 2026 | unknown | unknown | unknown | Some Uniswap/DeFi lifecycle relevance. | Options market too broad. | 27 |
| https://github.com/spock-mark1/corpus-protocol | Corpus | Cannes 2026 | unknown | unknown | unknown | Some agent identity/revenue relevance. | Agent-corp framing too broad. | 27 |
| https://github.com/mdengler/egnyc26 | ENSFromWei | New York 2026 | unknown | unknown | unknown | Possible ENS/payments fit. | Sponsor detail unresolved. | 26 |
| https://github.com/Lasssssa/PaintGlobal | PaintGlobal | Cannes 2026 | unknown | unknown | unknown | Some Lisbon physical proof angle. | Consumer/event app may be shallow. | 24 |
| https://github.com/Camillemtd/dueldefi | Defi | Cannes 2026 | unknown | unknown | unknown | Some gamified DeFi demo value. | Game loop may not prove sponsor inevitability. | 24 |
| https://github.com/jcruzfff/taptap-revolution | Tap Tap Revolution | New York 2026 | unknown | unknown | unknown | Some ENS/payment game relevance. | Prize details unresolved; game may be light. | 24 |
| https://github.com/duncancmt/porst | EVM PORST | Cannes 2026 | unknown | unknown | unknown | Technical primitive inspiration. | Hard to map to current sponsor product tracks. | 22 |
| https://github.com/alycz/Preo | Preo | New York 2026 | unknown | unknown | unknown | Some private policy-payment inspiration. | Canton/payroll fit unclear for Lisbon. | 20 |
| https://github.com/jmgomezl/aivy-studio | Kickoff Aivy Studio | New York 2026 | unknown | unknown | unknown | Unresolved AI agent/creator tooling. | Sponsor and technical extraction missing. | 15 |
| unresolved | ALMA | Cannes 2026 | hard/no repo | unknown | unknown | unresolved | No repo or project-page detail in vault. | 5 |

## 6. Idea Scorecard

Rubric: user pain /15, sponsor inevitability /20, proof artifact /15, replayable demo /15, open-source delta /10, adoption wedge /10, wow /10, scope /5.

| idea | pain | sponsor | proof | demo | OSS | adoption | wow | scope | total /100 | decision | rationale |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Human-backed x402 service desk | 14 | 19 | 14 | 14 | 9 | 8 | 8 | 4 | 90 | build first | Clear buyer/service failure mode; every primitive has a job. |
| Prompt-injection firewall for agent wallets | 14 | 17 | 14 | 14 | 8 | 7 | 8 | 4 | 86 | build | Strong before/after safety demo; scope must stay narrow. |
| LVR-aware Aqua/Uniswap allocator | 13 | 19 | 13 | 13 | 8 | 8 | 7 | 4 | 85 | build | Best DeFi route: hidden risk becomes one action. |
| DeFi position safety cockpit | 12 | 15 | 11 | 12 | 8 | 7 | 6 | 3 | 74 | rework into allocator | Too broad as an umbrella; narrow to LVR/Aqua/Uniswap. |
| Human-backed agent marketplace reputation | 12 | 17 | 12 | 12 | 8 | 7 | 7 | 3 | 78 | backup | Strong but broad; service desk is the smaller winning version. |
| Verifiable agent memory and audit trail | 11 | 16 | 12 | 12 | 8 | 7 | 7 | 3 | 76 | research more | Useful only if memory controls approval, ranking, or spend. |
| Private compliance router for DeFi actions | 12 | 9 | 12 | 11 | 7 | 7 | 5 | 3 | 66 | reject/rework | Strong historical pattern, but Chainlink-first version lacks confirmed Lisbon sponsor fit. |
| Private pay-per-use data/API access | 10 | 13 | 10 | 10 | 7 | 7 | 6 | 3 | 66 | reject | Too generic; becomes viable only if recast as the x402 service desk. |

Rejected under 70:
- Private pay-per-use data/API access in current form.
- Private compliance router for DeFi actions in Chainlink-first form.

## 7. Kill List

Avoid:
- Generic AI wrapper.
- Sponsor as login only.
- ENS as display name only.
- World ID as login only.
- Chainlink/data as display only.
- Dashboard with no decision/action.
- Too many sponsors with no central story.
- No public repo diff.
- No proof artifact.
- Demo depends on luck or external liquidity.
- Marketplace before one repeatable paid service works.
- Reputation score that cannot explain its factors.
- Privacy proof that does not allow, block, price, or settle an action.

## 8. Demo Scripts

### Human-Backed x402 Service Desk

| time | script |
|---|---|
| 0:00-0:20 | "Agents can buy APIs, but buyers still cannot tell who stands behind the work or what happens when the service fails." |
| 0:20-1:20 | Show an agent hitting a paid endpoint. It receives an x402 payment challenge, pays, and gets one human-backed result. |
| 1:20-2:20 | Show World proof for the backing human, ENS service identity, and The Graph-indexed service history. Then trigger a failed result and dispute. |
| 2:20-3:20 | Open the repo diff: added x402 gate, World proof check, ENS metadata, dispute state, indexer mapping. |
| 3:20-4:00 | Show reputation changed after dispute. Close with: Lisbon build proves paid agent services need identity, receipts, and failure handling. |

### Prompt-Injection Firewall for Agent Wallets

| time | script |
|---|---|
| 0:00-0:20 | "Agent wallets are useful until a prompt injection turns a helpful swap request into a malicious signing request." |
| 0:20-1:20 | Run a safe swap request: agent proposes transaction, policy checks it, wallet allows simulation. |
| 1:20-2:20 | Run the injected request: same agent identity, malicious instruction, policy blocks execution and logs the reason. |
| 2:20-3:20 | Open the repo diff: one transaction type, ENS agent identity, 0G reasoning receipt, Hedera log, indexed audit event. |
| 3:20-4:00 | Show audit search by agent name. Close with: useful agents need bounded permission, not blind autonomy. |

### LVR-Aware Aqua/Uniswap Allocator

| time | script |
|---|---|
| 0:00-0:20 | "LP dashboards show headline APR, but LPs can still lose to rebalancing drag and bad range choices." |
| 0:20-1:20 | Connect a wallet or sample position, load two pools, show fees, volatility, time in range, and LVR estimate. |
| 1:20-2:20 | Compare hold, tighten, widen, and Aqua route. Highlight the proof table and recommendation. |
| 2:20-3:20 | Open the repo diff: data adapter, LVR scoring module, strategy comparison, simulation output. |
| 3:20-4:00 | Show the action changing when volatility changes. Close with: the product replaces vanity APR with an executable decision. |

## 9. Final Recommendation

| bucket | recommendation | reason | confidence |
|---|---|---|---|
| build first | Human-backed x402 service desk | Best combination of user pain, sponsor inevitability, proof artifact, and open-source feature delta. | high |
| backup idea | Prompt-injection firewall for agent wallets | Strongest safety demo if the team has wallet/agent experience. | high |
| research more | LVR-aware Aqua/Uniswap allocator | High upside, but verify data/model feasibility before committing. | high |
| reject | Private pay-per-use data/API access | Too generic in current form; fold useful parts into service desk. | medium |
| reject | Private compliance router in Chainlink-first form | Good prior-winner pattern, but not enough current Lisbon sponsor inevitability. | medium |
| reject | Any sponsor-login or dashboard-only version of the above | Fails the proof-artifact and decision-action tests. | high |

Next research gates before coding:
- Recheck live Lisbon prize details and sponsor requirements.
- Pick one actual open-source repo and run setup.
- Confirm the proof artifact can be shown in under 30 seconds.
- Define the public diff before building UI.

## 10. Real Track Validation Protocol

Use this when official Lisbon track details are published.

Hard gates:
- Does the idea satisfy the sponsor's explicit qualification requirements?
- Is the sponsor primitive in the execution path, not just auth, naming, or display?
- Can the demo show the sponsor artifact in under 30 seconds?
- Is the repo public, runnable, and clear about the hackathon diff?
- Does the submission meet any required SDK, network, contract-address, video, or booth-demo rules?

Track update fields to capture:

| field | source | required action |
|---|---|---|
| sponsor | official prize page | Update matched tracks in this matrix. |
| prize title | official prize page | Map each idea to exact prize language. |
| qualification requirements | official prize page | Add pass/fail notes; reject noncompliant ideas. |
| required SDK/network | official docs/prize page | Confirm repo can integrate inside 36 hours. |
| submission artifacts | official prize page | Track demo video, contract addresses, README, setup, live link. |
| judging language | official prize page | Rescore sponsor inevitability and proof artifact. |
| links/resources | official docs/repos | Prefer official starter repos and maintained SDKs. |

Revalidation rule:
- Any idea loses 10 points if its primary sponsor is absent from final Lisbon tracks.
- Any idea loses 15 points if sponsor use is decorative under final track wording.
- Any idea under 70 after revalidation is rejected.
- If two ideas are within 5 points, choose the one with the stronger public open-source delta.

## 11. Open-Source Ecosystem Filter

Prioritize projects that leave reusable infrastructure, not only a single hackathon app.

Ecosystem-stimulating outputs:
- SDK adapter or plugin other teams can import.
- Subgraph/Substreams/indexer with public schema and examples.
- Smart contract extension with tests and deployment notes.
- Reference integration for a sponsor primitive in an existing repo.
- CLI/demo script that reproduces the full proof artifact.
- Docs showing how another builder can build on top of it.

Open-source score bonus:

| signal | points | why it matters |
|---|---:|---|
| Public reusable package/plugin | +4 | Other builders can adopt it directly. |
| Clean README/setup in under 10 minutes | +3 | Judges and ecosystem teams can verify it. |
| Example app plus core library split | +3 | Demo is visible, primitive is reusable. |
| Uses sponsor SDK in a generalizable path | +3 | Stimulates sponsor ecosystem, not one-off glue. |
| Tests or reproducible script for proof artifact | +2 | Makes the claim auditable. |
| Issue/PR path against upstream repo | +2 | Shows real open-source contribution intent. |

Open-source reject flags:
- Repo is only a frontend shell.
- Core logic is hidden in hosted services.
- README cannot reproduce the demo path.
- Sponsor code is a one-off script with hard-coded values.
- No license, no setup, or no public diff.
- Upstream project would not plausibly accept or reuse the work.

Best ecosystem bets from current vault:

| repo/project | ecosystem-stimulus angle | validation needed |
|---|---|---|
| AgentIndex | ENS + agent reputation indexer reusable by agent marketplaces. | Setup, schema, SDK usage, scoring logic. |
| Carry | Open LVR/risk module for Uniswap/1inch dashboards. | Data source, formula reproducibility, tests. |
| Clawback | Reusable x402 escrow/dispute primitive for paid agents. | Payment flow, dispute state, sponsor fit. |
| ENShell | Agent transaction firewall/policy module. | Scope beyond contract repo, demo path. |
| Proof-of-Human | World proof gate for scarce agent/human actions. | Generalize beyond drops/raffles. |
