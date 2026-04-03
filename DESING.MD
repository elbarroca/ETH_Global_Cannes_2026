# AlphaDawg — Design System & Complete UI Specification

> **Design philosophy:** Dark, bold, alive. A trading war room that feels like the cockpit of something powerful. Not a fintech dashboard — a weapon. The kind of interface where you feel smarter just looking at it.

---

## Brand Identity

### Name
**AlphaDawg** — Your AI pack hunts alpha.

### Logo
Abstract geometric wolf face. Two-layer red silhouette on near-black background with gold/amber eyes with dark pupils and gold nose mark.

**Logo SVG (copy directly into your app):**
```svg
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="4" width="112" height="112" rx="28" fill="#0C0A09"/>
  <path d="M28 92 L42 28 L60 48 L78 28 L92 92 Z" fill="#7F1D1D"/>
  <path d="M34 92 L46 36 L60 52 L74 36 L86 92 Z" fill="#DC2626"/>
  <circle cx="50" cy="54" r="4.5" fill="#FBBF24"/>
  <circle cx="70" cy="54" r="4.5" fill="#FBBF24"/>
  <circle cx="50" cy="54" r="2" fill="#0C0A09"/>
  <circle cx="70" cy="54" r="2" fill="#0C0A09"/>
  <path d="M55 69 L60 73 L65 69" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/>
</svg>
```

**Telegram avatar (circular):**
```svg
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <circle cx="60" cy="60" r="56" fill="#0C0A09"/>
  <path d="M30 88 L42 30 L60 48 L78 30 L90 88 Z" fill="#7F1D1D"/>
  <path d="M36 88 L46 38 L60 52 L74 38 L84 88 Z" fill="#DC2626"/>
  <circle cx="50" cy="54" r="4.5" fill="#FBBF24"/>
  <circle cx="70" cy="54" r="4.5" fill="#FBBF24"/>
  <circle cx="50" cy="54" r="2" fill="#0C0A09"/>
  <circle cx="70" cy="54" r="2" fill="#0C0A09"/>
  <path d="M55 68 L60 72 L65 68" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"/>
</svg>
```

### Voice & Personality
- Confident, not arrogant
- Sharp, not jargon-heavy
- The friend who's genuinely good at trading and explains what they're doing
- Use "hunt" language: "Your pack hunted 3 specialists" not "Your agent queried 3 APIs"

---

## Color System

### Primary Palette

```
BLOOD RED (primary action, wolf body, CTAs)
  50:  #FEF2F2   — backgrounds, subtle tints
  100: #FEE2E2   — hover states, light fills
  200: #FECACA   — secondary text on dark
  300: #FCA5A5   — descriptions, subtitles on dark
  400: #F87171   — secondary elements
  500: #EF4444   — inner wolf layer, secondary actions
  600: #DC2626   — PRIMARY — main wolf, buttons, active states
  700: #B91C1C   — hover on primary buttons
  800: #991B1B   — pressed states
  900: #7F1D1D   — outer wolf layer, deep accents

GOLD (eyes, highlights, important data, profits)
  50:  #FFFBEB   — subtle glow backgrounds
  100: #FEF3C7   — light accent fills
  200: #FDE68A   — eye glow, attention-grabbing text
  300: #FCD34D   — secondary gold
  400: #FBBF24   — PRIMARY — eyes, nose, key metrics, profit numbers
  500: #F59E0B   — hover on gold elements
  600: #D97706   — pressed gold
  700: #B45309   — dark gold accents

VOID (backgrounds, surfaces, depth)
  950: #0C0A09   — page background, deepest layer
  900: #1C1917   — card backgrounds, logo bg, navbar
  850: #1F1E1B   — elevated cards, modals
  800: #292524   — borders, dividers, subtle lines
  700: #44403C   — secondary borders, hover borders
  600: #57534E   — disabled text, hints
  500: #78716C   — tertiary text
  400: #A8A29E   — secondary text, descriptions
  300: #D6D3D1   — primary text (headings on dark)
  200: #E7E5E4   — bright text, numbers
  100: #F5F5F4   — white-equivalent text
```

### Semantic Colors

```
PROFIT / SUCCESS
  bg:     #052E16 (dark green tint)
  text:   #4ADE80 (bright green)
  accent: #22C55E (green for +% numbers)

LOSS / DANGER
  bg:     #450A0A (dark red tint — same family as brand red)
  text:   #FCA5A5 (soft red)
  accent: #EF4444 (matches brand)

WARNING / PENDING
  bg:     #451A03 (dark amber tint)
  text:   #FCD34D (gold-amber)
  accent: #F59E0B

INFO / LINKS
  bg:     #0C1222 (dark blue tint)
  text:   #93C5FD (soft blue)
  accent: #3B82F6

0G / SEALED (special — used for all 0G-related badges)
  bg:     #2E1065 (dark purple tint)
  text:   #C4B5FD (soft purple)
  accent: #8B5CF6

HEDERA (special — used for audit-related elements)
  bg:     #042F2E (dark teal tint)
  text:   #5EEAD4 (bright teal)
  accent: #14B8A6

ARC (special — used for payment-related elements)
  bg:     #172554 (dark blue tint)
  text:   #93C5FD (soft blue)
  accent: #3B82F6
```

### Tailwind Config Extension

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        void: {
          950: '#0C0A09',
          900: '#1C1917',
          850: '#1F1E1B',
          800: '#292524',
          700: '#44403C',
          600: '#57534E',
          500: '#78716C',
          400: '#A8A29E',
          300: '#D6D3D1',
          200: '#E7E5E4',
          100: '#F5F5F4',
        },
        blood: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
      },
    },
  },
}
```

---

## Typography

### Font Stack
```css
--font-primary: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
```

Use Inter for everything. JetBrains Mono for all data: prices, hashes, attestations, wallet addresses, agent outputs, code blocks.

### Scale
```
Hero title:      32px, font-weight 800, letter-spacing -1px, text-void-100
Page title:      22px, font-weight 700, letter-spacing -0.5px, text-void-200
Section title:   16px, font-weight 600, text-void-300
Card title:      14px, font-weight 600, text-void-200
Body:            14px, font-weight 400, text-void-400
Small:           12px, font-weight 400, text-void-500
Tiny:            11px, font-weight 500, uppercase, letter-spacing 1.5px, text-void-600 (labels)
Mono data:       13px, font-mono, font-weight 500, text-void-200
Mono secondary:  12px, font-mono, font-weight 400, text-void-500
```

### Special Text Styles
```
Profit numbers:  font-mono, font-weight 600, text-green-400 (#4ADE80)
Loss numbers:    font-mono, font-weight 600, text-blood-300 (#FCA5A5)
Gold highlights: font-mono, font-weight 600, text-gold-400 (#FBBF24)
Agent names:     font-weight 600, text-void-200
Attestation IDs: font-mono, text-xs, text-void-600, truncated with ...
```

---

## Component Library

### Cards

**Standard card (most content):**
```
bg-void-900
border: 1px solid void-800
border-radius: 16px (rounded-2xl)
No shadow. Ever.
```

**Elevated card (modals, popovers, important content):**
```
bg-void-850
border: 1px solid void-700
border-radius: 16px
```

**Stat card (metric cards at top of dashboard):**
```
bg-void-900
border: 1px solid void-800
border-radius: 12px (rounded-xl)
padding: 14px 16px
Label: 11px uppercase tracking-wider text-void-600
Value: 22px font-weight 700 text-void-100
Subtext: 12px text-green-400 or text-blood-300
```

**Agent card (marketplace):**
```
bg-void-900
border: 1px solid void-800
border-radius: 16px
padding: 16px
Hover: border-color transitions to void-700, subtle bg shift to void-850
```

### Badges

**Sealed badge (most important — 0G proof):**
```html
<span class="inline-flex items-center gap-1.5 text-xs font-mono
  bg-purple-950/50 text-purple-300 px-2 py-0.5 rounded-md
  border border-purple-800/30">
  <span class="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
  sealed
</span>
```

**Live badge:**
```html
<span class="inline-flex items-center gap-1.5 text-xs font-mono
  bg-blood-900/50 text-blood-300 px-2 py-0.5 rounded-md
  border border-blood-800/30">
  <span class="w-1.5 h-1.5 bg-blood-500 rounded-full animate-pulse"></span>
  live
</span>
```

**Status badges:**
```
Active/Win:   bg-emerald-950/50 text-emerald-400 border-emerald-800/30
Loss:         bg-blood-900/50 text-blood-300 border-blood-800/30
Hired:        bg-gold-400/10 text-gold-400 border-gold-400/20
0G iNFT:      bg-purple-950/50 text-purple-300 border-purple-800/30
Hedera:       bg-teal-950/50 text-teal-300 border-teal-800/30
Arc:          bg-blue-950/50 text-blue-300 border-blue-800/30
```

### Buttons

**Primary (hunt, deposit, main CTAs):**
```
bg-blood-600 hover:bg-blood-700 active:bg-blood-800
text-white font-semibold
rounded-xl
px-5 py-3
transition-colors duration-150
```

**Secondary:**
```
bg-void-800 hover:bg-void-700 active:bg-void-600
text-void-200
border: 1px solid void-700
rounded-xl
px-4 py-2.5
```

**Ghost (links, minor actions):**
```
bg-transparent hover:bg-void-800
text-void-400 hover:text-void-200
rounded-lg
px-3 py-1.5
```

**Gold accent (special actions like "Deploy Agent"):**
```
bg-gold-400/10 hover:bg-gold-400/20
text-gold-400
border: 1px solid gold-400/20
rounded-xl
px-4 py-2.5
```

### Code Blocks (agent output, reasoning)

```
bg-void-950
border: 1px solid void-800
border-radius: 10px
padding: 12px 14px
font-mono text-xs leading-relaxed
text-void-400
```

Important text within code blocks (recommendations, decisions):
```
Alpha rec:    text-green-400 font-semibold
Risk rec:     text-blood-300 font-semibold
Executor rec: text-gold-400 font-semibold
```

### Dividers
```
border-top: 1px solid void-800
OR for subtle sections:
border-top: 1px solid void-800/50
```

### Status Dots
```
Active/connected:  w-2 h-2 bg-emerald-500 rounded-full
Live/pulsing:      w-2 h-2 bg-blood-500 rounded-full animate-pulse
Warning:           w-2 h-2 bg-gold-400 rounded-full
Offline:           w-2 h-2 bg-void-600 rounded-full
0G computing:      w-2 h-2 bg-purple-500 rounded-full animate-pulse
```

---

## Layout System

### Page Structure
```
<body class="bg-void-950 text-void-300 font-sans">
  <nav>  — sticky top, bg-void-900, border-b border-void-800 </nav>
  <main class="max-w-7xl mx-auto px-5 py-6"> — content </main>
</body>
```

Note: max-w-7xl (wider than before) to give the dashboard room to breathe.

### Grid Gaps
```
Metric cards:    gap-3 (12px)
Main columns:    gap-4 (16px)
Marketplace:     gap-4 (16px)
Stacked cards:   gap-3 (12px)
```

---

## Navigation Bar

```
Height: 56px
Background: bg-void-900
Border: border-b border-void-800
Padding: px-5

LEFT:
  - Logo SVG (32x32)
  - "AlphaDawg" text-void-100 font-bold text-base tracking-tight
  - Live badge (blood variant)

CENTER:
  - Nav tabs: Dashboard, Pack, History, Deposit, Verify
  - Active: bg-void-800 text-void-100 font-medium rounded-lg px-3 py-1.5
  - Inactive: text-void-500 hover:text-void-300 transition
  - Note: "Marketplace" is now called "Pack" (fits the brand)

RIGHT:
  - 0G iNFT badge: "iNFT #0846" in purple badge style
  - Wallet: "0x7a3f...8b2c" in font-mono text-void-500
  - Avatar: 28x28 rounded-full, bg-gradient-to-br from-blood-600 to-gold-500
```

---

## Page 1: Dashboard

### Top Row: Metrics (5 columns)

```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ 💰 FUND NAV │ │ 🔄 HUNTS    │ │ 💸 PACK     │ │ 🎯 WIN RATE │ │ 🧠 0G SEALED│
│ $1,247.83  │ │ 48         │ │ SPEND      │ │ 76%        │ │ INFERENCES │
│ +4.2%      │ │ All sealed │ │ $0.58      │ │ Verified   │ │ 288        │
└────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

Card style: bg-void-900, border void-800, rounded-xl, p-3.5
- Label: 11px uppercase tracking-wider text-void-600
- Value: 22px font-bold text-void-100
- Sub: 12px text-green-400 (profit) or text-void-500 (neutral)

### "Hunt" Button
Centered above the three columns. This is the star of the demo.
```
bg-blood-600 hover:bg-blood-700
text-white font-bold text-sm
rounded-xl px-6 py-3
With wolf icon on the left and pulsing dot when active

"🐺 Hunt"  →  when clicked, changes to  "🔴 Hunting..."  with spinner
```

### Three-Column Layout

#### Column 1: Pack Intelligence (specialists)

**Card header:**
```
px-4 py-3 border-b border-void-800
Left: emerald dot + "ETH pack" text-void-200 font-semibold text-sm
Right: "3 hired" gold badge
```

**Each specialist block:**
```
Agent row:
  Left: emoji (text-base) + name (text-xs font-semibold text-void-200) + "0G iNFT" purple badge
  Right: "$0.001" text-xs font-mono text-void-500

Analysis block:
  bg-void-950 rounded-lg p-3
  font-mono text-xs leading-relaxed text-void-400

Below analysis:
  Left: sealed badge (clickable → goes to Verify page)
  Right: attestation hash truncated, text-xs font-mono text-void-600
```

#### Column 2: The Challenge (adversarial debate)

**Card header:**
```
Left: blood-500 pulsing dot + "The challenge" text-void-200 font-semibold
Right: "live" blood badge with pulse
```

**Each agent block:**
```
Header row:
  Left: colored emoji + name (font-semibold text-void-200)
  Right: sealed badge

Analysis block:
  bg-void-950 rounded-lg p-3
  font-mono text-xs leading-relaxed text-void-400
  Recommendation at end:
    Alpha:    text-green-400 font-semibold
    Risk:     text-blood-300 font-semibold
    Executor: text-gold-400 font-semibold

Footer:
  "0G: glm-5-chat" text-xs text-purple-400
  "·" separator
  attestation hash text-xs font-mono text-void-600
```

**Agent color mapping:**
```
Alpha:    🟢 or custom green circle, recommendations in green-400
Risk:     🔴 or custom blood circle, recommendations in blood-300
Executor: 🟡 or custom gold circle, recommendations in gold-400
```

#### Column 3: Intel + Audit (stacked)

**Card 3a: Arc Payments**
```
Header: blue dot + "Arc payments" + blue "USDC" badge
Body: rows of from → to with mono prices
Divider
Total row: bold
Footer: "Circle Nanopayments · Gas-free" text-blue-400
```

**Card 3b: Hedera Audit**
```
Header: teal dot + "Hedera audit"
Body: bg-void-950 code block
  Topic ID, sequence, timestamp in mono text-void-500
  "6 attestations · 3 payments · 1 decision" text-void-600
  "Verify on Hashscan →" text-teal-400 hover:underline
```

**Card 3c: Pack Memory (0G Storage)**
```
Header: purple dot + "Pack memory" + "0G Storage" purple badge
Body: list of memory items
  Cycle ref: text-purple-400 font-mono
  Memory text: text-void-500
```

### Bottom Bar
```
bg-void-900 rounded-2xl p-3 border border-void-800
Left: 📱 + "Telegram: Connected" + green dot
Right: Three chain badges in a row
  "0G Sealed" purple badge
  "Hedera HCS" teal badge
  "Arc Nano" blue badge
```

---

## Page 2: Pack (Marketplace)

### Section 1: "Your pack"
```
Header left: "Your pack" text-lg font-bold text-void-100
             "Specialists your Lead Dawg currently hires" text-void-500
Header right: "Lead Dawg: iNFT #0846" purple badge

Grid: 3 columns
```

**Active specialist card:**
```
bg-void-900 border border-void-800 rounded-2xl p-4
Hover: border-void-700 bg-void-850

Top-right corner: "0G iNFT" purple badge + "active" green badge (stacked or row)

Content:
  Large emoji (text-2xl) with subtle gold glow: 
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.1) on the emoji container
  Name: font-semibold text-sm text-void-200
  Skill: text-xs text-void-500
  "iNFT #0847 · 0G Chain" text-xs font-mono text-purple-400
  Stats row: "82% accuracy" text-green-400 + "445 hires" text-void-500
  "Model: glm-5-chat via 0G Sealed" text-xs text-void-600, model in text-purple-400

Bottom section (border-t border-void-800):
  Left: "$0.001/query" font-mono font-semibold text-void-200
  Right: "Paid via Arc USDC" text-xs text-blue-400
```

### Section 2: "Marketplace"
```
Header left: "Marketplace" text-lg font-bold text-void-100
             "Community-built specialists — minted as iNFTs on 0G" text-void-500
Header right: "Deploy your agent" gold accent button

Grid: 4 columns
```

**Community agent card:**
```
bg-void-900 border border-void-800 rounded-2xl p-3.5
Hover: border-blood-800/50 (subtle red glow on hover — this is the marketplace, things are for sale)

Top row: emoji left, "0G iNFT" badge right
Name: font-semibold text-sm text-void-200
Skill: text-xs text-void-500
"iNFT #1201" text-xs font-mono text-purple-400
"by 0x7a3f..." text-xs text-void-600
Stats: accuracy in green + hires in void-500

Bottom (border-t border-void-800):
  Left: "$0.002" font-mono font-semibold text-gold-400
  Right: "Hire" button — bg-blood-600 text-white text-xs rounded-lg px-3 py-1
```

---

## Page 3: History (Audit Trail)

```
Header: "Hunt log" text-lg font-bold text-void-100
        "All hunts recorded on Hedera HCS + 0G Sealed Inference" text-void-500
```

**Collapsed row:**
```
bg-void-900 border border-void-800 rounded-2xl
px-4 py-3 cursor-pointer
hover: bg-void-850

Left: 
  "#48" font-mono text-void-600
  "14:32" text-void-500
  "BUY 12% ETH" font-semibold text-void-200

Right:
  "+$6.14" font-mono font-semibold text-green-400
  "win" green badge
  "▼" text-void-600
```

**Expanded state (below divider):**
```
Three debate rows:
  🟢 Alpha: text in void-400
  🔴 Risk: text in void-400
  🟡 Executor: text in void-400

Footer row:
  sealed badge (purple)
  "6 × 0G Sealed" purple badge
  "Verify on Hashscan →" teal link
  "Verify on 0G →" purple link
  "HCS #48" font-mono text-void-600
```

---

## Page 4: Deposit

Centered, max-w-md.

**Main card:**
```
bg-void-900 border border-void-800 rounded-2xl p-6

Tab switcher: two buttons
  Active: bg-blood-600 text-white
  Inactive: bg-void-800 text-void-500

Amount input:
  bg-void-950 border border-void-800 rounded-xl
  text-xl font-mono font-bold text-void-100
  placeholder text-void-700
  focus: ring-2 ring-blood-600 border-transparent
  "USDC" label inside right side, text-void-500

Quick amounts: $1, $10, $50, $100
  bg-void-800 hover:bg-void-700 text-void-300 rounded-lg

Submit: full-width bg-blood-600 button
Footer: "Gas-free via Circle Nanopayments on Arc" text-void-600
```

**Position card:**
```
bg-void-900 border border-void-800 rounded-2xl p-4
Key-value rows:
  Labels: text-void-500
  Values: font-semibold text-void-200
  Profit values: text-green-400
  Fund shares: font-mono text-void-200
```

---

## Page 5: Verify (0G Explorer)

```
Header: "0G verification — hunt #48" text-lg font-bold text-void-100
        "Every inference sealed inside TEE hardware on 0G Compute" text-void-500
Right: "6 sealed inference calls" purple badge
```

**Agent selector grid (6 buttons in a row):**
```
Each button:
  bg-void-900 border border-void-800 rounded-xl p-3 text-center
  Hover: border-void-700
  Selected: bg-purple-950/50 border-2 border-purple-500

  Emoji (text-lg)
  Name (text-xs font-semibold text-void-200)
  Type (text-xs text-void-500)
```

**Proof detail card:**
```
bg-void-900 border border-void-800 rounded-2xl p-5

Header: large emoji + name + type + sealed badge

Two columns:
  Left — Agent details:
    4 stacked items, each:
      Label: 11px uppercase tracking-wider text-void-600
      Value: 14px font-mono text-void-200
    
    "Execution environment" row gets special treatment:
      "Intel TDX + NVIDIA H100 TEE" text-void-200
      + "Hardware isolated" green badge

  Right — TEE Attestation:
    bg-void-950 rounded-lg p-4
    Attestation hash in text-purple-400 font-mono
    Details in text-void-600 font-mono
    Divider
    "Verify on 0G Explorer →" text-purple-400

Explanation block (below columns):
  bg-purple-950/30 border border-purple-800/20 rounded-xl p-4
  text-xs leading-relaxed text-purple-200/80
```

**Memory card:**
```
Same as dashboard memory card
"Pack memory from 0G Storage"
Purple cycle refs + void-500 text
"View full memory on 0G Storage →" text-purple-400
```

---

## Animations & Micro-interactions

### Streaming Text (agent debate)
```css
/* Text appears character by character */
.streaming-text {
  overflow: hidden;
  border-right: 2px solid #FBBF24; /* gold cursor */
  animation: blink 0.8s step-end infinite;
}
@keyframes blink {
  50% { border-color: transparent; }
}
```

### Sealed Badge Entrance
```css
/* Pops in when attestation arrives */
.sealed-enter {
  animation: sealPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes sealPop {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
```

### Hunt Button Active State
```css
.hunting {
  animation: huntPulse 1.5s ease-in-out infinite;
}
@keyframes huntPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  50% { box-shadow: 0 0 0 12px rgba(220, 38, 38, 0); }
}
```

### Card Hover
```css
.agent-card {
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.agent-card:hover {
  border-color: #44403C; /* void-700 */
  background-color: #1F1E1B; /* void-850 */
}
```

### Payment Row Entrance
```css
/* Rows appear one by one as payments settle */
.payment-enter {
  animation: slideIn 0.25s ease-out;
}
@keyframes slideIn {
  from { transform: translateX(-8px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

### Number Count-Up
```css
/* Fund NAV, win rate, etc. count up on load */
/* Use JS: animate from 0 to target value over 600ms with easeOutCubic */
```

---

## Special Touches That Make It Memorable

### 1. Wolf Eyes Loading State
When a hunt is running, show the logo with eyes that pulse gold:
```css
.wolf-eyes-loading .eye {
  animation: eyePulse 1.2s ease-in-out infinite;
}
@keyframes eyePulse {
  0%, 100% { fill: #FBBF24; }
  50% { fill: #FDE68A; filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.6)); }
}
```

### 2. Agent Activity Glow
When an agent is actively computing (sealed inference running), its card border subtly glows:
```css
.agent-computing {
  border-color: #7F1D1D;
  box-shadow: 0 0 20px rgba(220, 38, 38, 0.08);
  transition: all 0.3s ease;
}
```

### 3. Gold Profit Flash
When a hunt results in profit, briefly flash the NAV card gold:
```css
.profit-flash {
  animation: goldFlash 0.6s ease;
}
@keyframes goldFlash {
  0% { background-color: #1C1917; }
  30% { background-color: rgba(251, 191, 36, 0.08); }
  100% { background-color: #1C1917; }
}
```

### 4. Hashscan Link Verification Pulse
When a user clicks "Verify on Hashscan", show a brief teal pulse confirming the action:
```css
.verify-pulse {
  animation: tealPulse 0.4s ease;
}
@keyframes tealPulse {
  0% { color: #5EEAD4; }
  50% { color: #99F6E4; text-shadow: 0 0 8px rgba(94, 234, 212, 0.3); }
  100% { color: #5EEAD4; }
}
```

---

## Responsive Notes

This is a hackathon — optimize for the demo screen (laptop, ~1280px-1440px wide).

However, keep these in mind:
- Metric cards: 5 columns → 3+2 on tablet, 2+2+1 on mobile
- Dashboard 3-column: → stacked vertically on mobile
- Marketplace 4-column: → 2 columns on tablet, 1 on mobile
- Agent selector 6-grid: → 3+3 on tablet, 2+2+2 on mobile
- Nav: horizontal tabs → hamburger or bottom bar on mobile

---

## Key Naming Changes from VaultMind

| VaultMind | AlphaDawg |
|---|---|
| Dashboard | Dashboard |
| Marketplace | **Pack** |
| Debate cycle | **Hunt** |
| "Run Cycle" button | **"Hunt"** button |
| Adversarial layer | **The Challenge** |
| Fund share tokens | **DAWG tokens** |
| Specialist agents | **Pack members** |
| History | **Hunt log** |
| Your Main Agent | **Your Lead Dawg** |
| Agent memory | **Pack memory** |

---

## Implementation Notes for Claude Code

1. **This is a dark-mode-only app.** No light mode. The entire design system assumes dark backgrounds. This is deliberate — trading dashboards are dark.

2. **Use Tailwind arbitrary values** for the custom colors: `bg-[#0C0A09]` or extend the config as shown above. The extend approach is cleaner.

3. **The logo is inline SVG**, not an image file. Copy the SVG directly into a React component. This ensures it's always crisp and loads instantly.

4. **Font loading:** Add Inter and JetBrains Mono via Google Fonts or next/font. JetBrains Mono is critical — all agent output must feel like a terminal.

5. **No shadows anywhere.** The depth comes from border colors and background shade differences. void-950 → void-900 → void-850 creates layering without shadows.

6. **The "Hunt" button is the most important interactive element.** Make it feel powerful. The pulse animation, the state change from "Hunt" to "Hunting...", the loading state with wolf eye glow — this is what judges click first.