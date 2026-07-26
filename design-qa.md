# Wallet-authority modal design QA

- Reference: `/var/folders/41/_dw_pjd939j0k29gkmp2rlbw0000gn/T/codex-clipboard-5014f137-f4ba-480e-92b1-dca881b052d5.png`
- Schema-blocked reference: `/var/folders/41/_dw_pjd939j0k29gkmp2rlbw0000gn/T/codex-clipboard-0e83105d-1c02-411c-96f6-e07ec710d39b.png`
- Stack capture: `test-results/visual/a5-create-stack-1440.png`
- Wallet capture: `test-results/visual/a5-create-wallet-1440.png`
- Viewports: 375 x 900, 768 x 900, and 1440 x 900/1000 CSS pixels
- Evidence class: local mocked UI evidence only; not Circle, Graph, 0G, deployment, or release proof

## Reference comparison

- Preserved the dark/gold shell, `max-w-5xl` dialog width, four-step sticky rail, two-column desktop composition, right-side preview, sticky footer, compact typography, Phosphor icons, responsive sheet behavior, and existing application assets.
- Replaced the obsolete ENS step without redesigning the shell. The equivalent state now shows the connected SIWE creator, server-returned Circle wallet tuple, immutable manifest, and fail-closed publication evidence.
- The latest managed-environment screenshot matches the intended blocked presentation: `Database update required`, operator-owned wallet-authority migration copy, Retry, disabled `Create unavailable`, no modal, no empty-state substitution, and no creation POST.
- Step 2 keeps the reference density while acting as a compact managed-stack hub: searchable approved skills and MCP servers, selected/connected states, counts, provider availability, and a selected-stack preview.
- The reference's duck overlay is not a repository asset and was not recreated or replaced. No new asset or visual system was introduced.

## Issue closure

- P0: fixed MCP UI metadata crossing the API boundary; serialized bindings are exactly `{ provider, capability }`. Fixed `KERNEL_SCHEMA_NOT_READY` so creation is disabled, the modal is suppressed, Retry remains available, and no POST is sent.
- P1: fixed wallet authority evidence and eligibility gates, lost-response replay, exact refusal states, 0G fallback/active-output refusal, MCP search/selection limits, and wallet rows with no blank ENS labels.
- P2: fixed responsive containment, long identifier compaction/copy affordances, keyboard focus, reduced motion, status copy, selected-stack hierarchy, and mobile/tablet/desktop overflow.

## Automated visual and interaction result

- Full Chromium lane: 32/32 passed.
- Focused creator journey: CREATE_DRAFT -> ATTACH_AGENT_WALLET -> PUBLISH_WALLET_VERSION -> ELIGIBLE receipt passed with exact request-body assertions.
- 0G generation: verified, unverified, fallback, malformed/active output, loading, and disabled states passed with mocked routes and no live call.
- MCP Market: discovery-only link, local approved-stack search, 1-3 skill limit, four-binding maximum/dedupe, Graph-only approved capabilities, and arbitrary endpoint absence passed.
- Accessibility/layout: focus trap and return, stage focus, reduced motion, long content, 375/768/1440 overflow <= 1px, and zero uncaught browser errors passed.

final result: VISUAL_PASS_LOCAL_MOCKED; SAME_SHA_LIVE_JOURNEY_REQUIRED
