---
globs: app/**, components/**, lib/**, contexts/**, hooks/**
---

# Next.js 16.2 Dashboard Rules (AlphaDawg)

## Stack
- Next.js 16.2 (App Router, Turbopack)
- React 19 (Server Components default)
- Tailwind CSS v4 (CSS-first config)
- Dynamic Labs SDK for wallet connect
- wagmi + viem for chain interactions

## Rules
- **Server Components by default.** Only add `"use client"` when the component needs state, effects, or event handlers.
- **Named exports only.** `export function Component()` — never `export default`.
- **PascalCase** components, **kebab-case** files.
- **No `any` types.** Use proper generics or `unknown` with narrowing.
- **Tailwind utility classes only.** No CSS modules, no styled-components.
- **Fetch in Server Components** with `{ next: { revalidate: N } }` for ISR.
- **`"use client"` components** go in `components/` when shared.

## Tailwind v4 — AlphaDawg Palette
```css
@import "tailwindcss";

@theme {
  --color-blood-600: #DC2626;
  --color-blood-900: #7F1D1D;
  --color-gold-400: #FBBF24;
  --color-void-950: #0C0A09;
  --color-void-900: #1C1917;
  --color-void-800: #292524;
}
```
No `tailwind.config.js` — config lives in CSS via `@theme`.

## Pages
- `/` — Landing page (server component, real HCS + HTS stats)
- `/dashboard` — 3-column debate view (client component, 10s polling)
- `/history` — Hunt log / cycle history (client component, expandable)
- `/deposit` — Deposit/withdraw USDC + HTS tokens (client component)
- `/marketplace` — Specialist pack + community agents (client component)
- `/verify` — TEE attestation verification (client component)
- `/portfolio` — Fund balance, NAV, token info

## Data Sources
- Backend API: `localhost:3001/api/*` (Express server — onboard, cycle, fund, actions)
- Hedera Mirror Node: `https://testnet.mirrornode.hedera.com/api/v1/...`
- Specialist APIs: `localhost:4001-4003`
- Next.js API routes proxy to backend or hit mirror node directly

## File Layout
```
app/          ← Pages (App Router)
components/   ← Shared UI (cycle-view, debate-column, nav, proof-column, specialist-card, ui/)
lib/          ← API client, types, cycle-mapper, mock-data
contexts/     ← user-context, wagmi-provider
hooks/        ← use-vaultmind
```
