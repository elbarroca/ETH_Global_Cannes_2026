# Sprint: Agent Voice & Debate Rewrite

**Date**: April 4, 2026  
**Status**: COMPLETE  
**Branch**: `feat/agent-voice-debate-rewrite`  
**Tests**: 12/12 parseDualOutput unit tests, 32/32 pipeline consistency checks, 0 type errors, clean production build

---

## Problem

Current prompts produce dry JSON with "max 15 words." The compute page reads like a database dump. Judges see:

```
Alpha: {"action":"BUY","pct":12,"argument":"Strong sentiment convergence"}
Risk:  {"max_pct":10,"risks":["funding rates"],"challenge":"Funding rates elevated"}
```

No debate. No tension. No story.

## Solution

Dual-output format: conversational reasoning (3-5 sentences) that streams to the UI + structured JSON for the system. Each agent has a distinct voice. Debate agents now cross-reference each other's arguments.

```
Alpha says: "Three out of three specialists are signaling accumulation. Whale tracker sees
12,400 ETH leaving exchanges — that's not retail, that's institutions positioning. RSI at
44 means we're not chasing a top. I'm calling for 15% allocation."
→ {"action":"BUY","asset":"ETH","pct":15,"thesis":"Whale accumulation + RSI recovery = textbook setup"}

Risk fires back: "Alpha's ignoring the elephant in the room. SentimentBot — our HIGHEST
confidence read at rep 780 — is screaming SELL. And MomentumX flagged declining volume..."
→ {"max_pct":5,"risks":["highest-rep disagrees","declining volume","funding elevated"],"objection":"weak case"}
```

---

## What Was Built

### Phase 1: Parsing Infrastructure

| File | What | Why |
|------|------|-----|
| `src/agents/prompts.ts` | `extractLastJson()` — brace-depth-counting JSON extractor | Old regex `/\{[^{}]*\}/` failed on nested JSON (arrays, braces in strings). New function scans from last `{`, counts depth, validates with `JSON.parse()`, tries earlier `{` on failure |
| `src/agents/prompts.ts` | `parseDualOutput<T>(raw, fallback)` — splits reasoning from JSON | Strips markdown fences, calls `extractLastJson`, returns `{ reasoning, parsed }`. Never throws. Handles: pure JSON, reasoning+JSON, fenced JSON, garbage, empty |
| `src/agents/prompts.ts` | `safeJsonParse()` preserved | Backward compat for any code still using it |

**Edge cases verified (12 tests):**
- Pure JSON (no reasoning) → `reasoning: ""`, parsed correctly
- Reasoning + JSON → both extracted
- Markdown fenced JSON → fences stripped
- No JSON → fallback used, raw text as reasoning
- Nested JSON with arrays (`risks: [...]`) → parsed correctly
- Curly braces inside string values (`"RSI {divergence}"`) → handled
- Multiple JSON objects → picks last valid one
- Empty string → fallback

### Phase 2: Type Definitions

| File | Change | Backward Compat |
|------|--------|-----------------|
| `src/types/index.ts` | `DebateResult.alpha/risk/executor.reasoning?: string` | Optional — old records without it are valid |
| `src/types/index.ts` | `SpecialistResult.reasoning?: string` | Optional |
| `src/types/index.ts` | `CompactCycleRecord.adv.a/r/e.r?: string` | Optional — old HCS records without `r` still render |
| `lib/api.ts` | `DebateStage.reasoning?: string` | Mirrors backend |
| `lib/api.ts` | `SpecialistResult.reasoning?: string` | Mirrors backend |
| `lib/api.ts` | `CompactCycleRecord.adv.*.r?: string` | Mirrors backend |

### Phase 3: Prompt Rewrites (6 agents)

| Agent | Old Output | New Output |
|-------|-----------|------------|
| SentimentBot | `{"signal":"BUY","confidence":65,"reasoning":"max 15 words"}` | 2-4 sentences citing F&G, crowd behavior, then JSON |
| WhaleEye | `{"signal":"HOLD","confidence":50,"reasoning":"max 15 words"}` | 2-4 sentences suspicious detective analysis, then JSON |
| MomentumX | `{"signal":"BUY","confidence":70,"reasoning":"max 15 words"}` | 2-4 sentences walking through RSI/MACD/volume conflicts, then JSON |
| Alpha Synthesizer | `{"action":"BUY","pct":12,"argument":"max 25 words"}` | 3-5 sentences building the bull case, then JSON with `thesis` |
| Risk Challenger | `{"max_pct":10,"challenge":"max 25 words"}` | 3-5 sentences tearing apart Alpha's claims, then JSON with `objection` |
| Executor Judge | `{"action":"BUY","pct":8,"reasoning":"max 15 words"}` | 3-5 sentences weighing both sides, then JSON with `reasoning` |

**Key prompt design decisions:**
- JSON schema example placed at end of prompt (last thing 7B model sees before generating)
- Explicit "THINK OUT LOUD first" / "BUILD YOUR CASE" / "TEAR IT APART" headers
- Sentence count instructions (2-4 for specialists, 3-5 for debate) to prevent overlong output
- Rules section reinforces structure: "Your reasoning MUST be X sentences before the JSON"

### Phase 4: Backend Inference Pipeline

| File | Change | Detail |
|------|--------|--------|
| `src/agents/adversarial.ts` | `inferWithRetry()` returns `reasoning` field | Uses `parseDualOutput` instead of `safeJsonParse` |
| `src/agents/adversarial.ts` | Retry emphasis message updated | Old: "Return ONLY valid JSON" → New: "Write 2-3 sentences of reasoning, then output valid JSON" |
| `src/agents/adversarial.ts` | Debate agents see each other's reasoning | Risk gets `Alpha argues: "{reasoning}"`. Executor gets both. Creates real cross-referencing |
| `src/agents/adversarial.ts` | Fallback constants updated | `ALPHA_FALLBACK.thesis`, `RISK_FALLBACK.objection` match new prompt JSON schemas |
| `src/agents/adversarial.ts` | `buildSpecialistContext()` includes reasoning | Debate agents see specialist reasoning alongside data points |
| `src/agents/specialist-server.ts` | Uses `parseDualOutput` | Replaces `safeJsonParse` |
| `src/agents/specialist-server.ts` | Reasoning fallback chain | `dual.reasoning \|\| parsed.reasoning \|\| ""` — prevents empty string overwriting JSON's inner reasoning field |
| `src/og/inference.ts` | `max_tokens: 512 → 768` | Accommodates ~50-80 extra reasoning tokens |

### Phase 5: Data Flow & Storage

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added 3 nullable columns: `alpha_reasoning`, `risk_reasoning`, `exec_reasoning` on Cycle model |
| `src/store/action-logger.ts` | `logCycleRecord()` accepts `reasoning?: string` on alpha/risk/executor, writes to new Prisma columns |
| `src/store/action-logger.ts` | Added `TRADE_EXECUTED` to `ActionType` union (pre-existing build error fix) |
| `src/agents/main-agent.ts` | `buildCompactRecord()` adds `r` field (60-char truncated reasoning) to `adv.a`, `adv.r`, `adv.e` |
| `src/agents/main-agent.ts` | HCS byte-limit safety: drops `r` fields if `JSON.stringify(record) > 950 bytes` (limit is 1024) |
| `src/agents/main-agent.ts` | `commitCycle()` passes `reasoning` through to `logCycleRecord()` |
| `src/agents/main-agent.ts` | `riskParsed` type handles both `challenge` (old) and `objection` (new) |

### Phase 6: Frontend

| File | Change |
|------|--------|
| `lib/cycle-mapper.ts` | `mapCycleResultToCycle()`: uses `debate.alpha.reasoning` as primary `argument` text, falls back to `parsed.thesis ?? parsed.argument` |
| `lib/cycle-mapper.ts` | `mapCompactRecordToCycle()`: uses `record.adv.a.r` as argument, falls back to existing format |
| `lib/cycle-mapper.ts` | Specialist `analysis` field enriched: reasoning + signal line when reasoning available |
| `app/dashboard/page.tsx` | `pendingAsCycle`: uses `debate.alpha.reasoning` with fallback chain (reasoning → thesis → argument → JSON.stringify) |
| `app/dashboard/page.tsx` | Fixed `stopLoss` sign: now correctly negated (`-pendingCycle.compactRecord.adv.e.sl`) |

### Phase 7: Telegram

| File | Change |
|------|--------|
| `src/telegram/formatter.ts` | `formatAnalysisPreview()`: shows 120-char reasoning excerpts (up from 80-char flat field values) |
| `src/telegram/formatter.ts` | `formatDebate()`: appends `r` excerpts in italics when available from CompactCycleRecord |
| `src/telegram/formatter.ts` | Fallback order: `reasoning → objection → challenge` and `reasoning → argument → thesis` |

### Phase 8: OpenClaw Documentation

| File | Change |
|------|--------|
| `openclaw/main-agent/SOUL.md` | "Lead Dawg" — glass box orchestrator, transparent, relentless |
| `openclaw/alpha-agent/SOUL.md` | Confident trader on a desk call, conviction-driven, data-citing |
| `openclaw/risk-agent/SOUL.md` | Risk manager who's been burned, paranoid but not a brick wall |
| `openclaw/executor-agent/SOUL.md` | Judge delivering a verdict, measured, commits after weighing |
| `openclaw/sentiment-agent/SOUL.md` | Sharp-eyed crowd reader, contrarian instincts |
| `openclaw/whale-agent/SOUL.md` | Suspicious on-chain detective, questions everything |
| `openclaw/momentum-agent/SOUL.md` | Chart reader, mechanical, flags indicator conflicts |
| All 6 `IDENTITY.md` files | Updated output format: "First: N sentences of reasoning. Then: JSON" |

---

## Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| `reasoning?: string` (optional everywhere) | Old PendingCycle records in DB lack `reasoning`. Making it required would be a type lie at runtime |
| Brace-depth-counting JSON parser over regex | Regex `/\{[^{}]*\}/` fails on nested JSON (Risk's `risks` array). Depth counter handles arbitrary nesting + validates with `JSON.parse()` |
| 60-char truncated `r` field in CompactCycleRecord | Full reasoning would blow the 1024-byte HCS limit. 60 chars gives enough context for Telegram/compact display. Full reasoning lives in Supabase + 0G Storage |
| `max_tokens: 768` (up from 512) | Reasoning adds ~50-80 tokens. Conservative bump with headroom |
| New field names (`thesis`, `objection`) with old fallbacks | Alpha's prompt now uses `thesis` (not `argument`), Risk uses `objection` (not `challenge`). Mappers check new first, old second, for backward compat |
| Debate agents see each other's *reasoning* text, not just JSON | Risk sees Alpha's full argument, not just `{"action":"BUY","pct":15}`. Creates genuine cross-referencing in the debate |

---

## Files Changed (22 total)

**Backend (10):**
- `src/agents/prompts.ts` — `parseDualOutput()` + 6 prompt rewrites
- `src/agents/adversarial.ts` — reasoning extraction + debate cross-referencing
- `src/agents/specialist-server.ts` — dual output parsing + reasoning fallback
- `src/agents/main-agent.ts` — compact record reasoning + HCS safety + commit flow
- `src/og/inference.ts` — max_tokens bump
- `src/types/index.ts` — reasoning fields on 3 interfaces
- `src/store/action-logger.ts` — reasoning params + Prisma writes + TRADE_EXECUTED
- `src/telegram/formatter.ts` — reasoning excerpts in all formats
- `prisma/schema.prisma` — 3 nullable columns
- `lib/api.ts` — frontend type mirrors

**Frontend (2):**
- `lib/cycle-mapper.ts` — reasoning as primary display text
- `app/dashboard/page.tsx` — reasoning in pendingAsCycle + stopLoss fix

**OpenClaw (13):**
- 7 SOUL.md files — vivid character-driven personalities
- 6 IDENTITY.md files — dual-output format documentation

---

## Verification

| Check | Result |
|-------|--------|
| `parseDualOutput()` unit tests (12 edge cases) | 12/12 PASS |
| Pipeline field consistency (32 cross-file checks) | 32/32 PASS |
| `npx tsc --noEmit` | 0 errors |
| `npx prisma generate` | Client generated with 3 new columns |
| `npm run build` | Clean production build, all routes compile |

---

## What's Next

- Run `npx prisma db push` to sync new columns to Supabase (additive, non-breaking)
- Live test with `npm run backend` + `curl POST /api/cycle/analyze/:userId` to verify reasoning in responses
- Visual test: dashboard Pack column now shows sentences, Challenge column shows adversarial debate
- Monitor 7B model compliance with dual-output format after deployment — if models frequently fail, increase `max_tokens` to 1024
