---
globs: openclaw/**
---

# OpenClaw Rules

## File Structure (per agent workspace)
7 possible files: `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`, `MEMORY.md`

## Rules
- **SOUL.md = personality ONLY.** No procedures, no tool lists, no steps.
- **Procedures go in AGENTS.md** (main-agent only).
- **IDENTITY.md** = name, role, short capability list.
- **Heartbeat default is 30m.** Override in `openclaw.json`: `"heartbeat": { "every": "5m" }`.
- All prompts must be optimized for **7B models**: concise, structured, unambiguous.
- Specialist agents only need `SOUL.md` and `IDENTITY.md`.
- Main agent needs all 5: `SOUL.md`, `IDENTITY.md`, `AGENTS.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`.
- Keep SOUL.md under 200 words — 7B models lose coherence with long system prompts.
