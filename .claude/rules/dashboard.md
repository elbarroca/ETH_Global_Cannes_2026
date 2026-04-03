---
globs: src/dashboard/**, app/**
---

# Next.js 16.2 Dashboard Rules

## Stack
- Next.js 16.2 (App Router, Turbopack)
- React 19 (Server Components default)
- Tailwind CSS v4 (CSS-first config)

## Rules
- **Server Components by default.** Only add `"use client"` when the component needs state, effects, or event handlers.
- **Named exports only.** `export function Component()` — never `export default`.
- **PascalCase** components, **kebab-case** files.
- **No `any` types.** Use proper generics or `unknown` with narrowing.
- **Tailwind utility classes only.** No CSS modules, no styled-components.
- **Fetch in Server Components** with `{ next: { revalidate: N } }` for ISR.
- **`"use client"` components** go in `src/dashboard/components/` when shared.

## Tailwind v4
```css
@import "tailwindcss";

@theme {
  --color-vault-primary: #6366f1;
  --color-vault-dark: #0f172a;
}
```
No `tailwind.config.js` — config lives in CSS via `@theme`.

## Pages
- `/` — Landing page (server component)
- `/dashboard` — 3-column debate view (client component for live updates)
- `/history` — Mirror Node cycle history (server component with revalidation)
- `/invest` — Deposit/withdraw HTS tokens (client component)

## Data Sources
- Hedera Mirror Node: `https://testnet.mirrornode.hedera.com/api/v1/...`
- Specialist APIs: `localhost:4001-4003`
- Internal API routes for Telegram/bot state
