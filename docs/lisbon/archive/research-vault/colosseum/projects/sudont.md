# Sudont

Links: [[colosseum/solana-frontier-2026|Frontier event]] · [[colosseum/projects/00_Project_Index|Frontier project index]] · [[strategy/colosseum-to-lisbon-transfer-map|Lisbon transfer map]] · [[sponsors/00_Sponsor_Index#Colosseum Frontier Sponsors|Frontier sponsors]]

Status: awarded Colosseum Frontier project note  
Access date: 2026-06-26  
Source quality: Arena API + official winners post; sponsor fit is inferred because Frontier had no tracks.

## Track / Category Setup

| field | value |
|---|---|
| award bucket | top_25_winner |
| applied track | No sponsor track application. Frontier removed tracks/bounties; this project competed by category and startup merit. |
| Colosseum category | Security Tools |
| evaluation path | project submitted to Frontier -> judged as startup/product -> winner interview/evaluation for possible accelerator |
| country | United States |
| team handles | sudont |

## Purpose / Ideation

| field | value |
|---|---|
| one-line product | The bare-metal execution firewall and local RPC for Solana. After running a passive node and seeing thousands of trapped bots fail transactions, I built Sudont. Defensively, it simulates state diffs inline via LiteSVM to block honeypots instantly. Offensively, it unlocks sub-millisecond Monte Carlo simulations for quant trading. No SaaS round-tripsjust deterministic, zero-latency execution inside your decision window. |
| user pain | Agentic crypto execution can be unsafe and hard to inspect locally. |
| solution loop | Bare-metal execution firewall and local RPC protect Solana actions. |
| why it likely fit Colosseum | Likely scored for urgent agent-security pain and reusable developer infrastructure. |
| hackathon idea lesson | Direct Lisbon transfer to prompt-injection firewall and local policy gate. |
| reject if | Security claim without reproducible repo or testable threat model. |

## Repo / Surface

| surface | value |
|---|---|
| Arena | https://arena.colosseum.org/projects/explore/sudont |
| API | https://api.colosseum.org/api/project?slug=sudont&type=HACKATHON |
| repo | https://github.com/sudont-labs/sudont-core |
| repo status | repo URL exists but GitHub API unavailable: HTTP Error 404: Not Found |
| website | https://sudont.xyz |
| website signal | status=200; title=Sudont  Bare-Metal Execution Firewall for autonomous agents; desc=A drop-in dual-engine RPC proxy that simulates every transaction locally  revm for EVM, LiteSVM for SVM  before it reaches the chain. Inline execution physics for autonomous agents. Zero LLMs in the hot path. |
| X/Twitter | unresolved |
| pitch/demo | https://www.loom.com/share/8d10d5f2f2384133b5b0f63897fb098f |

## Sponsor / Onchain Fit

- [[sponsors/00_Sponsor_Index#Solana Foundation|Solana Foundation]]: baseline Solana integration and startup ecosystem fit
- [[sponsors/00_Sponsor_Index#Phantom|Phantom]]: wallet UX, consumer onboarding, and signing surface
- [[sponsors/00_Sponsor_Index#Raydium|Raydium]]: liquidity, DeFi, trading, or routing surface

## KPI Surface

Measured KPIs found: unresolved.

Track these if diligencing:
- unsafe executions blocked
- false-positive rate
- latency overhead

## Open-Source / Ecosystem Value

| field | value |
|---|---|
| ecosystem value /50 | 28 |
| reusable primitive | Security Tools primitive; exact implementation unresolved until repo review |
| best upstream path | setup docs + reusable module/API/schema + tests or reproducible demo script |
| audit status | not audited |

## Research Gaps

- Repo URL is listed by Arena API, but GitHub API metadata is unavailable; manual repo review still required.
- Twitter/X handle unresolved in Arena API.

## Sources

- https://arena.colosseum.org/projects/explore/sudont
- https://api.colosseum.org/api/project?slug=sudont&type=HACKATHON
- https://sudont.xyz
- https://github.com/sudont-labs/sudont-core
- https://www.loom.com/share/8d10d5f2f2384133b5b0f63897fb098f
