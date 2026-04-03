# VaultMind — Design System

> Brutalist terminal aesthetic. Monospace everything. Teal is the only color that matters.
> If it doesn't serve the data, it doesn't exist.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Design Tokens](#2-design-tokens)
3. [Typography](#3-typography)
4. [Color System](#4-color-system)
5. [Spacing & Layout Grid](#5-spacing--layout-grid)
6. [Borders & Surfaces](#6-borders--surfaces)
7. [Motion System](#7-motion-system)
8. [Icon & Symbol Language](#8-icon--symbol-language)
9. [Navigation & Shell](#9-navigation--shell)
10. [Component Library](#10-component-library)
11. [Page Layouts](#11-page-layouts)
12. [Timeline Waterfall — The Debate View](#12-timeline-waterfall)
13. [Onboarding Flow](#13-onboarding-flow)
14. [Marketplace View](#14-marketplace-view)
15. [Responsive Strategy](#15-responsive-strategy)
16. [Tailwind v4 Configuration](#16-tailwind-v4-configuration)
17. [Implementation Notes](#17-implementation-notes)

---

## 1. Design Philosophy

### The Rules

1. **No decoration.** Every pixel serves the data or the interaction. No gradients, no shadows, no rounded corners, no illustrations.
2. **Monospace is the voice.** JetBrains Mono everywhere. The interface speaks like a terminal because VaultMind IS a terminal into your agent swarm.
3. **Teal is the signal.** `#06B6D4` (cyan-500) is the only chromatic accent. It means "alive," "active," "verified," or "actionable." Everything else is grayscale.
4. **High contrast, low noise.** Pure white text on near-black backgrounds. No mid-grays for primary content. If the user needs to read it, it's white. If it's secondary, it's `#71717A` (zinc-500). Nothing in between.
5. **Borders define space.** No shadows, no elevation, no blur. 1px solid borders in `#27272A` (zinc-800) separate content. That's the only spatial tool.
6. **Data is the hero.** Numbers are larger than labels. Hashes are displayed proudly. JSON is shown raw. The system does not apologize for being technical.

### The Feeling

When a judge opens VaultMind, it should feel like opening a mission control terminal for an autonomous financial system. Not a consumer app. Not a crypto dashboard. A **control interface** for AI agents managing real money with cryptographic proof.

The closest references (for mood, not to copy): Bloomberg Terminal, Stripe's developer dashboard, Linear's density, a military radar screen.

### What We Never Do

- Round corners (everything is `rounded-none` or `rounded-sm` at most for inputs)
- Box shadows
- Gradient backgrounds
- Colored backgrounds on containers (only borders)
- Emoji in the UI (text labels only)
- Placeholder illustrations or decorative SVGs
- Loading spinners (use pulsing text: `Loading...` with opacity animation)
- Marketing language in the dashboard (save it for the landing page)

---

## 2. Design Tokens

### Tailwind v4 CSS Custom Properties

```css
@theme {
  /* ── BACKGROUNDS ── */
  --color-bg-primary: #09090B;      /* zinc-950 — main background */
  --color-bg-secondary: #18181B;    /* zinc-900 — panels, cards */
  --color-bg-tertiary: #27272A;     /* zinc-800 — hover states, active items */
  --color-bg-input: #09090B;        /* same as primary — inputs are invisible until focused */

  /* ── BORDERS ── */
  --color-border-default: #27272A;  /* zinc-800 — standard borders */
  --color-border-hover: #3F3F46;    /* zinc-700 — hover/focus borders */
  --color-border-active: #06B6D4;   /* cyan-500 — active/selected state */

  /* ── TEXT ── */
  --color-text-primary: #FAFAFA;    /* zinc-50 — primary content */
  --color-text-secondary: #A1A1AA;  /* zinc-400 — labels, descriptions */
  --color-text-tertiary: #71717A;   /* zinc-500 — timestamps, metadata */
  --color-text-disabled: #52525B;   /* zinc-600 — disabled/inactive */
  --color-text-accent: #06B6D4;     /* cyan-500 — links, active items */

  /* ── ACCENT (TEAL/CYAN) ── */
  --color-accent-50: #ECFEFF;
  --color-accent-100: #CFFAFE;
  --color-accent-200: #A5F3FC;
  --color-accent-300: #67E8F9;
  --color-accent-400: #22D3EE;
  --color-accent-500: #06B6D4;      /* PRIMARY — the accent */
  --color-accent-600: #0891B2;
  --color-accent-700: #0E7490;
  --color-accent-900: #164E63;

  /* ── SEMANTIC ── */
  --color-success: #22C55E;         /* green-500 — verified, profit, Alpha */
  --color-danger: #EF4444;          /* red-500 — error, loss, Risk */
  --color-warning: #EAB308;         /* yellow-500 — Executor, pending */
  --color-info: #06B6D4;            /* cyan-500 — same as accent */

  /* ── AGENT COLORS (used ONLY in debate view) ── */
  --color-agent-alpha: #22C55E;     /* green-500 */
  --color-agent-risk: #EF4444;      /* red-500 */
  --color-agent-executor: #EAB308;  /* yellow-500 */
  --color-agent-specialist: #06B6D4;/* cyan-500 */

  /* ── TYPOGRAPHY ── */
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', ui-monospace, monospace;

  /* ── SPACING SCALE ── */
  --space-px: 1px;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-24: 6rem;     /* 96px */

  /* ── TRANSITIONS ── */
  --duration-fast: 100ms;
  --duration-default: 150ms;
  --duration-slow: 300ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 3. Typography

### Font

**JetBrains Mono** — Primary and only font. Load weights 400 (regular), 500 (medium), and 700 (bold).

```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

Fallback stack: `'IBM Plex Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace`

### Type Scale

All sizes in `rem`. Monospace runs wider than sans-serif, so sizes are slightly smaller than typical scales.

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `text-display` | 2rem (32px) | 700 | 1.1 | Landing page hero, page titles (rare) |
| `text-heading` | 1.25rem (20px) | 700 | 1.3 | Section headers, panel titles |
| `text-subhead` | 1rem (16px) | 500 | 1.4 | Subsection headers, nav items |
| `text-body` | 0.875rem (14px) | 400 | 1.5 | Primary body text, form labels |
| `text-small` | 0.75rem (12px) | 400 | 1.5 | Metadata, timestamps, secondary info |
| `text-micro` | 0.6875rem (11px) | 400 | 1.4 | Badges, tags, footnotes |

### Type Rules

- **Numbers are always `tabular-nums`.** Financial data must column-align. Set `font-variant-numeric: tabular-nums` globally on monospace.
- **Hashes and addresses truncate in the middle.** Display as `0x7f2a...e41b` — never at the end.
- **ALL CAPS for labels only.** Status badges, column headers, section labels. Never for body text.
- **Letter-spacing: `0.02em` on ALL CAPS text.** Monospace needs breathing room when capitalized.
- **No italics.** Brutalist rule. Emphasis = bold or teal color, never italic.

---

## 4. Color System

### The Palette

The entire UI uses exactly 3 hues: **gray** (zinc), **teal** (cyan-500), and **semantic colors** (red/green/yellow for the debate view only).

```
BACKGROUNDS          BORDERS              TEXT
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ #09090B     │     │ #27272A     │     │ #FAFAFA     │  primary
│ zinc-950    │     │ zinc-800    │     │ zinc-50     │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ #18181B     │     │ #3F3F46     │     │ #A1A1AA     │  secondary
│ zinc-900    │     │ zinc-700    │     │ zinc-400    │
├─────────────┤     └─────────────┘     ├─────────────┤
│ #27272A     │                         │ #71717A     │  tertiary
│ zinc-800    │     ACCENT              │ zinc-500    │
└─────────────┘     ┌─────────────┐     └─────────────┘
                    │ #06B6D4     │
                    │ cyan-500    │     ACCENT TEXT
                    └─────────────┘     ┌─────────────┐
                                        │ #06B6D4     │
                                        │ cyan-500    │
                                        └─────────────┘
```

### When Teal Appears

Teal (#06B6D4) is used **only** for:

- Active navigation item (left border + text)
- Focused input border
- Primary CTA button background
- Links (text only, no underline until hover)
- "Verified" / "Live" / "Active" status indicators
- Timeline waterfall — the active step's left border
- The pulsing dot on live cycle indicator

Teal never appears as a background fill on large surfaces. It is always a border, text color, or small indicator.

### Semantic Colors (Debate View Only)

These appear exclusively inside the timeline waterfall and debate-related components:

| Color | Hex | Agent | Usage |
|-------|-----|-------|-------|
| Green | `#22C55E` | Alpha | Alpha's argument card left-border, "FOR" label |
| Red | `#EF4444` | Risk | Risk's argument card left-border, "AGAINST" label |
| Yellow | `#EAB308` | Executor | Executor's card left-border, "DECISION" label |
| Teal | `#06B6D4` | Specialists | Specialist report cards, "ANALYSIS" label |

Outside the debate view, **none of these colors appear** except in standard success/error states.

---

## 5. Spacing & Layout Grid

### Spacing Scale

Use Tailwind's default scale. Primary spacings: `4`, `6`, `8`, `12`, `16`.

### Shell Layout

```
┌─────────────────────────────────────────────────────────┐
│ TOPBAR (h-12, border-b)                                 │
│ Logo · Nav breadcrumb · Status indicator · Wallet       │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│ SIDE   │  MAIN CONTENT                                  │
│ NAV    │                                                │
│        │  Focused panel view                            │
│ w-56   │  max-w-5xl mx-auto                             │
│        │  px-8 py-6                                     │
│ border │                                                │
│ -r     │                                                │
│        │                                                │
│        │                                                │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│ STATUSBAR (h-8, border-t)                               │
│ Cycle #48 · Last: 2m ago · Next: 3m · 3 specialists    │
└─────────────────────────────────────────────────────────┘
```

### Grid Rules

- **Sidebar:** Fixed `w-56` (224px). Collapsed to icon-only `w-14` on smaller screens.
- **Main content:** `max-w-5xl` (1024px) centered with `mx-auto`. Generous `px-8 py-6` padding.
- **Panels inside main:** Full width of the content area. Stack vertically. Separated by `space-y-6`.
- **No multi-column grid inside panels** (except the marketplace table). Data flows top to bottom.

---

## 6. Borders & Surfaces

### Border Rules

- **All containers:** `border border-zinc-800` (1px solid #27272A)
- **Hover:** `border-zinc-700` (lighten one step)
- **Active/Selected:** `border-cyan-500` (teal accent)
- **Dividers inside panels:** `border-t border-zinc-800` — horizontal only, never vertical inside a panel
- **No rounded corners** on containers. Use `rounded-none` explicitly. Exception: input fields get `rounded-sm` (2px) for usability.

### Surface Hierarchy

```
Layer 0 — Page background:    bg-zinc-950  (#09090B)
Layer 1 — Panels/cards:       bg-zinc-900  (#18181B) + border-zinc-800
Layer 2 — Hover/active:       bg-zinc-800  (#27272A)
Layer 3 — Input focused:      bg-zinc-950 + border-cyan-500
```

**No shadows. No blur. No elevation.** Depth is communicated through border contrast and background shade only.

---

## 7. Motion System

### Philosophy

Motion exists to confirm state changes, not to entertain. Every transition is 150ms. Nothing bounces. Nothing overshoots. Nothing delays.

### Transition Tokens

```css
/* Standard transition for all interactive elements */
.vm-transition {
  transition-property: color, background-color, border-color, opacity;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Content appearing (panels, timeline steps) */
.vm-fade-in {
  animation: vmFadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes vmFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Timeline step activation (the waterfall moment) */
.vm-step-activate {
  animation: vmStepActivate 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes vmStepActivate {
  from { opacity: 0.3; border-left-color: #27272A; }
  to { opacity: 1; border-left-color: var(--step-color); }
}

/* Pulsing live indicator */
.vm-pulse {
  animation: vmPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes vmPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

### Where Motion Happens

| Element | Trigger | Animation |
|---------|---------|-----------|
| Nav items | Hover / active | 150ms color + border-left-color |
| Panel content | Page load | 150ms fade-in with 4px translateY |
| Timeline steps | Cycle progresses | 300ms step-activate (opacity + border-color) |
| Live indicator dot | Always running | 2s pulse (opacity) |
| Buttons | Hover | 150ms background-color |
| Status badges | State change | 150ms background-color + text-color |
| Toast notifications | Appear/dismiss | 150ms opacity |

### Where Motion Does Not Happen

- Page transitions (instant, no route animations)
- Sidebar open/close (instant on breakpoint, no slide)
- Modals (instant appear with backdrop, no scale)
- Data table sorting (instant re-render)
- Number updates (instant, no count-up animations)

---

## 8. Icon & Symbol Language

No icon library. VaultMind uses **text symbols and ASCII** as icons, consistent with the terminal aesthetic.

| Concept | Symbol | Context |
|---------|--------|---------|
| Verified / TEE | `[✓]` | Attestation verified badge |
| Unverified | `[✗]` | TEE check failed |
| Pending | `[…]` | Awaiting result |
| Active/Live | `●` | Pulsing teal dot, 6px |
| Inactive | `○` | Static gray dot, 6px |
| Cycle running | `▶` | In statusbar |
| Cycle paused | `‖` | In statusbar |
| Arrow right | `→` | Breadcrumbs, flow indicators |
| Arrow down | `↓` | Timeline progression |
| Separator | `·` | Inline metadata separation |
| Expand | `[+]` | Expandable sections |
| Collapse | `[-]` | Collapsible sections |
| External link | `↗` | Hashscan links |

### Hash Display

Always truncate to first 6 + last 4 characters:
```
0x7f2a8b...e41b
```
Full hash available on hover (tooltip) or click (copy to clipboard with `Copied.` confirmation).

---

## 9. Navigation & Shell

### Topbar (h-12)

```
┌─────────────────────────────────────────────────────────┐
│  VAULTMIND          Dashboard → Cycle #48     ● LIVE    │
│                                          0x7f2a...e41b  │
└─────────────────────────────────────────────────────────┘
```

- **Left:** `VAULTMIND` in `text-subhead font-bold tracking-widest uppercase text-zinc-50`
- **Center:** Breadcrumb path in `text-small text-zinc-500`. Active segment in `text-zinc-50`.
- **Right:** Live indicator (pulsing teal `●` + "LIVE" label), wallet address (truncated, click to copy)

### Sidebar (w-56)

```
┌──────────┐
│           │
│  ▸ DASHBOARD  ← active (teal left border + teal text)
│    HISTORY
│    MARKETPLACE
│    INVEST
│           │
│  ──────── │  ← divider (border-t border-zinc-800)
│           │
│    SETTINGS
│           │
│  ──────── │
│           │
│  CYCLE #48│  ← mini status block
│  ● LIVE   │
│  NAV $512 │
│  3m next  │
│           │
└──────────┘
```

**Active item:** `border-l-2 border-cyan-500 text-cyan-500 bg-zinc-900`
**Inactive item:** `border-l-2 border-transparent text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50`
**Text style:** `text-small font-medium uppercase tracking-wider`

### Statusbar (h-8)

```
┌─────────────────────────────────────────────────────────┐
│ ▶ CYCLE #48 · LAST: 2M AGO · NEXT: 3M · HIRED: 3      │
│                                          $0.003 SPENT   │
└─────────────────────────────────────────────────────────┘
```

Monospace, `text-micro`, all uppercase, `text-zinc-500`. Active values in `text-zinc-50`. "LIVE" status in `text-cyan-500`.

---

## 10. Component Library

### 10.1 — Button

**Primary (teal)**
```
┌─────────────────┐
│  CONNECT WALLET  │  bg-cyan-500 text-zinc-950 font-bold
└─────────────────┘    hover:bg-cyan-400 active:bg-cyan-600
                       uppercase text-small tracking-wider
                       px-4 py-2 rounded-none border-none
```

**Secondary (outline)**
```
┌─────────────────┐
│  VIEW ON HASHSCAN│  bg-transparent text-zinc-50 border border-zinc-700
└─────────────────┘    hover:border-zinc-500 hover:text-white
                       uppercase text-small tracking-wider
                       px-4 py-2 rounded-none
```

**Ghost (text only)**
```
│  CANCEL          │  bg-transparent text-zinc-500
                      hover:text-zinc-50
                      uppercase text-small tracking-wider
                      px-4 py-2
```

### 10.2 — Data Panel

The fundamental container for all dashboard content.

```
┌─────────────────────────────────────────────┐
│ PANEL TITLE                          [+]    │  ← header: border-b border-zinc-800
│                                             │     px-4 py-3, text-small uppercase
├─────────────────────────────────────────────┤     tracking-wider text-zinc-500
│                                             │
│  Content area                               │  ← body: px-4 py-4
│  bg-zinc-900 border border-zinc-800         │
│                                             │
└─────────────────────────────────────────────┘
```

No rounded corners. No shadow. Header and body separated by `border-b`.

### 10.3 — Key-Value Row

For displaying labeled data points:

```
DEPOSIT AMOUNT              $50.00 USDC
NET ASSET VALUE                $512.34
FUND SHARES                    102.47
CYCLE COUNT                        48
```

- Left: `text-small text-zinc-500 uppercase tracking-wider`
- Right: `text-body text-zinc-50 font-medium tabular-nums text-right`
- Row: `flex justify-between items-center py-2 border-b border-zinc-800/50`

### 10.4 — Status Badge

```
[✓] TEE VERIFIED     → text-micro uppercase, text-green-500, bg-green-500/10, px-2 py-0.5
[…] PENDING          → text-micro uppercase, text-yellow-500, bg-yellow-500/10
[✗] FAILED           → text-micro uppercase, text-red-500, bg-red-500/10
● LIVE               → text-micro uppercase, text-cyan-500 (dot pulses)
○ INACTIVE           → text-micro uppercase, text-zinc-600
```

No rounded corners on badges. `rounded-none`. Border: `border border-{color}/20`.

### 10.5 — Input Field

```
┌─────────────────────────────────────────────┐
│ DEPOSIT AMOUNT                              │  label: text-micro uppercase
├─────────────────────────────────────────────┤         tracking-wider text-zinc-500
│ 50.00                                       │         mb-1
├─────────────────────────────────────────────┤  input: bg-zinc-950 border border-zinc-800
│ USDC available: 1,240.00                    │         text-body text-zinc-50
└─────────────────────────────────────────────┘         focus:border-cyan-500
                                                        focus:outline-none
                                                        px-3 py-2 rounded-sm
                                                 hint:  text-micro text-zinc-600 mt-1
```

### 10.6 — Table

```
SPECIALIST        REPUTATION    ACCURACY    HIRED     COST
─────────────────────────────────────────────────────────
Sentiment Pro         782        0.73       142    $0.001
Whale Watcher v2      650        0.61        98    $0.001
Momentum Scan         420        0.44        67    $0.001
─────────────────────────────────────────────────────────
```

- Header: `text-micro uppercase tracking-wider text-zinc-500 border-b border-zinc-700 pb-2`
- Rows: `text-small text-zinc-50 py-2 border-b border-zinc-800/50`
- Hover row: `hover:bg-zinc-800/30`
- Numbers: `tabular-nums text-right`
- Reputation > 700: `text-cyan-500`
- Reputation < 300: `text-red-500`

### 10.7 — Toast / Notification

Appears top-right, stacks downward. No animation on appear (instant opacity toggle).

```
┌─────────────────────────────────────────────┐
│ CYCLE #48 COMPLETE · BUY 12% ETH · SL -4%  │
│ hashscan.io/testnet/topic/0.0.5934 ↗       │
└─────────────────────────────────────────────┘
```

`bg-zinc-900 border border-zinc-700 px-4 py-3 text-small`
Auto-dismiss after 8 seconds. Click to dismiss immediately.

---

## 11. Page Layouts

### 11.1 — Landing Page (`/`)

The landing page is the ONLY place where marketing language appears. It is a single screen, no scroll, designed to convert a visitor into a connected user.

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                                                         │
│                                                         │
│       VAULTMIND                                         │
│                                                         │
│       A multi-agent adversarial investment               │
│       system with cryptographic proof                    │
│       of reasoning.                                     │
│                                                         │
│       Your agent hires specialists.                      │
│       Debates every trade.                               │
│       Proves every decision on-chain.                    │
│                                                         │
│                                                         │
│       ┌──────────────────────┐                          │
│       │   CONNECT WALLET     │  ← Primary CTA           │
│       └──────────────────────┘     bg-cyan-500           │
│                                                         │
│                                                         │
│       3 CHAINS · 7 AGENTS · EVERY DECISION PROVEN       │
│                                                         │
│                                                         │
│ ──────────────────────────────────────────────────────  │
│ ARC: $0.001 PAYMENTS    0G: TEE VERIFIED    HEDERA: HCS │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Background: `bg-zinc-950`
- Title: `text-display font-bold text-zinc-50`
- Subtitle: `text-body text-zinc-400` with line breaks per sentence
- CTA: Primary button, centered
- Bottom bar: `text-micro text-zinc-600 uppercase tracking-widest`
- No images. No gradients. No animations. Text and a button.

### 11.2 — Onboard Page (`/onboard`)

Three-step progress displayed as a vertical sequence:

```
┌─────────────────────────────────────────────────────────┐
│ ONBOARDING                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──┐                                                   │
│  │01│  CONNECT WALLET                                   │
│  └──┘  Status: COMPLETED                     [✓]        │
│   │                                                     │
│   │    Connected: 0x7f2a...e41b                          │
│   │                                                     │
│  ┌──┐                                                   │
│  │02│  CONNECT TELEGRAM                      ← ACTIVE   │
│  └──┘                                                   │
│   │                                                     │
│   │    Click to open Telegram and link your account.     │
│   │    ┌──────────────────────────────────┐              │
│   │    │  OPEN TELEGRAM ↗                 │              │
│   │    └──────────────────────────────────┘              │
│   │                                                     │
│  ┌──┐                                                   │
│  │03│  DEPOSIT USDC                          ○ PENDING   │
│  └──┘                                                   │
│                                                         │
│        Locked until Telegram is connected.               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- Step numbers: `text-heading font-bold text-zinc-700` (inactive), `text-cyan-500` (active), `text-zinc-50` (completed)
- Vertical connector: `border-l-2 border-zinc-800` between steps, `border-cyan-500` for completed path
- Active step has a white title + full content
- Pending steps are dimmed: `text-zinc-600`, content hidden

### 11.3 — Dashboard Page (`/dashboard`)

The primary view. Shows the **last completed cycle** and the **live cycle** (if running).

```
┌─────────────────────────────────────────────────────────┐
│ DASHBOARD                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ PORTFOLIO SUMMARY ──────────────────────────────┐   │
│  │ NAV            $512.34    SHARES     102.47       │   │
│  │ DEPOSIT        $500.00    P&L        +$12.34      │   │
│  │ CYCLES              48    LAST       2m ago       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ CURRENT CYCLE #48 ─────────────── ● LIVE ───────┐   │
│  │                                                   │   │
│  │  [TIMELINE WATERFALL — see section 12]            │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ PROOF ──────────────────────────────────────────┐   │
│  │ HCS SEQUENCE     #48                              │   │
│  │ TOPIC            0.0.5934                         │   │
│  │ HASHSCAN         hashscan.io/testnet/... ↗        │   │
│  │ TIMESTAMP        2026-04-03T14:32:07Z             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Three panels stacked vertically: Summary (key-value rows), Current Cycle (timeline waterfall), Proof (links + metadata).

### 11.4 — History Page (`/history`)

Reverse-chronological list of past cycles, pulled from Mirror Node.

```
┌─────────────────────────────────────────────────────────┐
│ HISTORY                                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CYCLE   TIMESTAMP              ACTION    NAV    PROOF  │
│  ─────────────────────────────────────────────────────  │
│  #48     2026-04-03T14:32:07Z   BUY 12%  $512   ↗      │
│  #47     2026-04-03T14:27:03Z   HOLD     $508   ↗      │
│  #46     2026-04-03T14:22:01Z   BUY 8%   $508   ↗      │
│  #45     2026-04-03T14:17:00Z   SELL 5%  $503   ↗      │
│  ...                                                    │
│                                                         │
│  Showing 25 of 48 · LOAD MORE                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Click any row to expand inline and show the full cycle record (specialists + debate + proof hashes).

### 11.5 — Marketplace Page (`/marketplace`)

Specialist leaderboard with reputation data.

```
┌─────────────────────────────────────────────────────────┐
│ MARKETPLACE                                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  RANK  SPECIALIST        REP   ACC    CYCLES  STATUS    │
│  ─────────────────────────────────────────────────────  │
│  01    Sentiment Pro      782  0.73   142     ● ACTIVE  │
│  02    Whale Watcher v2   650  0.61    98     ● ACTIVE  │
│  03    OnChain Flows      590  0.58    76     ○ IDLE    │
│  04    Momentum Scan      420  0.44    67     ● ACTIVE  │
│  05    RSI Bot            280  0.31    45     ○ IDLE    │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  5 SPECIALISTS REGISTERED · 3 HIRED THIS CYCLE          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Reputation color coding: `> 700 → text-cyan-500`, `300-700 → text-zinc-50`, `< 300 → text-red-500`

### 11.6 — Invest Page (`/invest`)

Deposit and withdraw interface.

```
┌─────────────────────────────────────────────────────────┐
│ INVEST                                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ DEPOSIT ────────────────────────────────────────┐   │
│  │                                                   │   │
│  │  AMOUNT                                           │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ 50.00                                       │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │  USDC AVAILABLE: 1,240.00                         │   │
│  │                                                   │   │
│  │  ┌──────────────────────┐                         │   │
│  │  │  DEPOSIT USDC        │                         │   │
│  │  └──────────────────────┘                         │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ POSITION ───────────────────────────────────────┐   │
│  │ DEPOSITED          $500.00                        │   │
│  │ CURRENT NAV        $512.34                        │   │
│  │ FUND SHARES        102.47 VMFS                    │   │
│  │ P&L                +$12.34 (+2.47%)               │   │
│  │                                                   │   │
│  │  ┌──────────────────────┐                         │   │
│  │  │  WITHDRAW             │  ← secondary button     │   │
│  │  └──────────────────────┘                         │   │
│  └───────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 12. Timeline Waterfall — The Debate View

This is the centerpiece of the entire product. When a cycle runs, the timeline waterfall shows each step lighting up in sequence. This is what judges watch during the demo.

### Structure

```
CURRENT CYCLE #48                                    ● LIVE
─────────────────────────────────────────────────────────

 ┃  14:32:01  HIRING SPECIALISTS                     [✓]
 ┃
 ┃   ┌ SENTIMENT PRO ──────────────────── REP: 782 ─┐
 ┃   │ score: 72 · class: bullish · fear_greed: 68   │
 ┃   │ [✓] TEE VERIFIED · paid $0.001 · arc_001      │
 ┃   └───────────────────────────────────────────────┘
 ┃
 ┃   ┌ WHALE WATCHER V2 ─────────────── REP: 650 ──┐
 ┃   │ net_flow: accumulating · exchange: outflow    │
 ┃   │ [✓] TEE VERIFIED · paid $0.001 · arc_002      │
 ┃   └───────────────────────────────────────────────┘
 ┃
 ┃   ┌ MOMENTUM SCAN ────────────────── REP: 420 ──┐
 ┃   │ rsi: 58 · macd: bullish · trend: up           │
 ┃   │ [✓] TEE VERIFIED · paid $0.001 · arc_003      │
 ┃   └───────────────────────────────────────────────┘
 ┃
 ┃  14:32:08  ADVERSARIAL DEBATE                     [✓]
 ┃
 ┃   ┌ ALPHA ──────────────────────────── FOR ───────┐
 ▎   │ Sentiment + Whale aligned bullish (high rep).  │
 ▎   │ BUY 20% ETH.                                  │
 ▎   │ [✓] TEE · 0x1234...abcd                        │
 ┃   └───────────────────────────────────────────────┘
 ┃
 ┃   ┌ RISK ───────────────────────────── AGAINST ───┐
 ▎   │ Momentum low rep (420). RSI nearing            │
 ▎   │ overbought. MAX 10%.                           │
 ▎   │ [✓] TEE · 0x5678...ef01                        │
 ┃   └───────────────────────────────────────────────┘
 ┃
 ┃   ┌ EXECUTOR ───────────────────────── DECISION ──┐
 ▎   │ action: BUY · asset: ETH · pct: 12             │
 ▎   │ stop_loss: -4% · reasoning: "Compromise."      │
 ▎   │ [✓] TEE · 0x9abc...2345                        │
 ┃   └───────────────────────────────────────────────┘
 ┃
 ┃  14:32:14  SETTLEMENT                              [✓]
 ┃
 ┃   Logged to HCS · Sequence #48
 ┃   hashscan.io/testnet/topic/0.0.5934 ↗
 ┃   Memory stored · 0G root: 0xdef0...6789
 ┃
 ┃  14:32:15  NOTIFIED                                [✓]
 ┃
 ┃   Telegram summary sent to user.
 ┃
 ─── CYCLE COMPLETE · NEXT IN 4:45 ──────────────────────
```

### Implementation

```
TIMELINE ANATOMY:

┃  ← vertical line (border-l-2)
┃     zinc-800 = pending
┃     cyan-500 = active step (pulses)
┃     zinc-600 = completed
┃
┃  TIMESTAMP  STEP LABEL                        STATUS
┃             ↓
┃   ┌─ CARD ────────────────────────────────────────┐
▎   │  border-l-4 with agent color                   │
▎   │  bg-zinc-900 border border-zinc-800            │
▎   │  px-4 py-3                                     │
┃   └────────────────────────────────────────────────┘
```

### Card Left-Border Colors

| Card Type | Left Border Color | Label |
|-----------|------------------|-------|
| Specialist report | `border-l-cyan-500` | ANALYSIS |
| Alpha argument | `border-l-green-500` | FOR |
| Risk argument | `border-l-red-500` | AGAINST |
| Executor decision | `border-l-yellow-500` | DECISION |

### Activation Sequence

When a cycle runs live, steps activate top-to-bottom with 300ms staggered animations:

1. **HIRING** step label appears, timeline border turns `cyan-500`
2. Specialist cards fade in one-by-one (150ms each, 200ms stagger)
3. **DEBATE** step label appears
4. Alpha card fades in (green left border)
5. Risk card fades in (red left border)
6. Executor card fades in (yellow left border)
7. **SETTLEMENT** step appears with HCS link
8. **NOTIFIED** step appears
9. Timeline border transitions to `zinc-600` (completed gray)

### React Component Structure

```tsx
<TimelineWaterfall cycleId={48} status="live">
  <TimelineStep
    time="14:32:01"
    label="HIRING SPECIALISTS"
    status="completed"
  >
    <SpecialistCard
      name="Sentiment Pro"
      reputation={782}
      data={{ score: 72, class: "bullish" }}
      teeVerified={true}
      paymentId="arc_001"
      cost="$0.001"
    />
    {/* ... more specialists */}
  </TimelineStep>

  <TimelineStep
    time="14:32:08"
    label="ADVERSARIAL DEBATE"
    status="active"
  >
    <DebateCard agent="alpha" label="FOR" color="green">
      {alphaContent}
    </DebateCard>
    <DebateCard agent="risk" label="AGAINST" color="red">
      {riskContent}
    </DebateCard>
    <DebateCard agent="executor" label="DECISION" color="yellow">
      {executorContent}
    </DebateCard>
  </TimelineStep>

  <TimelineStep
    time="14:32:14"
    label="SETTLEMENT"
    status="pending"
  >
    <ProofLinks hcsSequence={48} hashscanUrl="..." rootHash="..." />
  </TimelineStep>

  <TimelineStep time="14:32:15" label="NOTIFIED" status="pending" />
</TimelineWaterfall>
```

---

## 13. Onboarding Flow

### States

```
Step 1: CONNECT WALLET
  → idle: "Connect your wallet to begin."
  → connecting: "Waiting for wallet..."
  → connected: "Connected: 0x7f2a...e41b" [✓]

Step 2: CONNECT TELEGRAM
  → locked: dimmed, "Complete step 1 first."
  → idle: "Link your Telegram to receive cycle reports."
  → waiting: "Waiting for Telegram confirmation..."  (poll every 2s)
  → bound: "Telegram connected." [✓]

Step 3: DEPOSIT USDC
  → locked: dimmed, "Complete step 2 first."
  → idle: Amount input + "DEPOSIT USDC" button
  → confirming: "Confirm in wallet..."
  → deposited: "Deposited $50.00 · 100 VMFS minted." [✓]
  → redirect: auto-navigate to /dashboard after 2s
```

### Vertical Connector

The vertical line between steps uses the same `border-l-2` pattern as the timeline waterfall:

- Completed segment: `border-cyan-500`
- Active segment: `border-cyan-500` (pulsing)
- Pending segment: `border-zinc-800`

This creates visual consistency between onboarding and the cycle view. The user learns the "timeline" pattern once and sees it everywhere.

---

## 14. Marketplace View

### Specialist Detail (expanded row)

When a user clicks a specialist row, it expands inline:

```
─────────────────────────────────────────────────────────
  SENTIMENT PRO                              REP: 782
─────────────────────────────────────────────────────────

  ENDPOINT        https://sent-pro.agents.xyz/analyze
  PRICE           $0.001
  TAGS            sentiment · social · news
  REGISTERED      2026-04-01T09:00:00Z
  TOTAL CYCLES    142
  ACCURACY        0.73

  LAST 10 PREDICTIONS:
  ✓ ✓ ✗ ✓ ✓ ✓ ✗ ✓ ✓ ✓

  REPUTATION HISTORY:
  800 ┤
  750 ┤         ╭─╮
  700 ┤    ╭───╯  ╰──╮  ╭──
  650 ┤───╯           ╰─╯
  600 ┤
      └──────────────────────
       -30d              now

─────────────────────────────────────────────────────────
```

The reputation chart is rendered as a simple SVG sparkline — monochrome (`stroke: #06B6D4`, `fill: none`), no axes labels, no grid. Just the line.

---

## 15. Responsive Strategy

### Breakpoints

| Breakpoint | Width | Layout Change |
|------------|-------|---------------|
| `sm` | 640px | — |
| `md` | 768px | Sidebar collapses to icon-only (`w-14`) |
| `lg` | 1024px | Full sidebar (`w-56`) |
| `xl` | 1280px | — |

### Mobile (< 768px)

- Sidebar becomes a bottom tab bar (4 tabs: Dashboard, History, Marketplace, Invest)
- Topbar simplifies: logo + wallet button only
- Statusbar moves to below topbar (always visible)
- Timeline waterfall is full-width, cards stack normally
- All panels are full-width with `px-4`

### Tablet (768px - 1024px)

- Sidebar collapses to icon-only (`w-14`). Hover shows tooltip with label.
- Main content takes full remaining width
- Timeline waterfall cards may truncate long text

### Desktop (> 1024px)

- Full layout as designed
- Main content maxes at `max-w-5xl`

---

## 16. Tailwind v4 Configuration

### Global CSS (`app/globals.css`)

```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');

@theme {
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  --color-accent: #06B6D4;
}

/* Base resets for brutalist aesthetic */
*, *::before, *::after {
  border-radius: 0;
}

body {
  font-family: var(--font-mono);
  background-color: #09090B;
  color: #FAFAFA;
  font-variant-numeric: tabular-nums;
  -webkit-font-smoothing: antialiased;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* Remove all default rounded corners */
button, input, select, textarea {
  border-radius: 2px; /* rounded-sm — only exception */
}

/* Selection color */
::selection {
  background-color: #06B6D4;
  color: #09090B;
}

/* Scrollbar (brutalist thin) */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #09090B; }
::-webkit-scrollbar-thumb { background: #27272A; }
::-webkit-scrollbar-thumb:hover { background: #3F3F46; }
```

### Utility Classes (add to Tailwind config)

```css
@utility vm-transition {
  transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1),
              background-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
              border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
              opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

@utility vm-fade-in {
  animation: vmFadeIn 150ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@utility vm-pulse {
  animation: vmPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@utility vm-step-activate {
  animation: vmStepActivate 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes vmFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes vmPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes vmStepActivate {
  from { opacity: 0.3; border-left-color: #27272A; }
  to { opacity: 1; border-left-color: var(--step-color); }
}
```

---

## 17. Implementation Notes

### Font Loading

Load JetBrains Mono via Google Fonts in `app/layout.tsx`:

```tsx
import { JetBrains_Mono } from 'next/font/google';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={mono.variable}>
      <body className="font-mono bg-zinc-950 text-zinc-50 antialiased">
        {children}
      </body>
    </html>
  );
}
```

### Component File Naming

```
src/dashboard/components/
├── shell/
│   ├── topbar.tsx
│   ├── sidebar.tsx
│   └── statusbar.tsx
├── data/
│   ├── data-panel.tsx
│   ├── key-value-row.tsx
│   ├── status-badge.tsx
│   └── hash-display.tsx
├── timeline/
│   ├── timeline-waterfall.tsx
│   ├── timeline-step.tsx
│   ├── specialist-card.tsx
│   └── debate-card.tsx
├── marketplace/
│   ├── specialist-table.tsx
│   ├── specialist-detail.tsx
│   └── reputation-sparkline.tsx
├── onboard/
│   ├── onboard-flow.tsx
│   ├── step-wallet.tsx
│   ├── step-telegram.tsx
│   └── step-deposit.tsx
└── ui/
    ├── button.tsx
    ├── input.tsx
    ├── toast.tsx
    └── tooltip.tsx
```

### Data Flow for Timeline

The timeline waterfall needs real-time updates during a live cycle. Implementation approach:

1. **Server-Sent Events (SSE)** from the orchestrator to the dashboard
2. Dashboard subscribes to `/api/cycle/stream?wallet={address}`
3. Each SSE event updates one step in the timeline
4. React state drives which steps are `completed`, `active`, or `pending`

```tsx
// Simplified event types
type CycleEvent =
  | { type: 'specialist_hired'; data: SpecialistResult }
  | { type: 'alpha_complete'; data: DebateResult }
  | { type: 'risk_complete'; data: DebateResult }
  | { type: 'executor_complete'; data: DebateResult }
  | { type: 'settlement_complete'; data: ProofData }
  | { type: 'cycle_complete' };
```

### Performance Considerations

- **Mirror Node polling:** Dashboard polls every 10 seconds for history, not every render. Cache results in React state.
- **SSE connection:** One per user session. Reconnect with exponential backoff (1s, 2s, 4s, max 30s).
- **Timeline cards:** Virtualize if more than 20 past cycles are displayed (unlikely in normal view).
- **Font subsetting:** JetBrains Mono is ~100KB for 3 weights. Acceptable. Use `display=swap` to prevent FOIT.

---

*This design system is the single source of truth for all VaultMind UI implementation. Every component, every color, every spacing value is defined here. When in doubt, refer back to Section 1: if it doesn't serve the data, it doesn't exist.*