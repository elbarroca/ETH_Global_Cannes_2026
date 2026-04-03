---
description: Build a specialist agent with x402 paywall and 0G sealed inference
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Agent
---

# Build Specialist Agent

Build a specialist agent for VaultMind's hiring economy. Each specialist:
1. Runs as an Express server with x402 paywall on a dedicated port
2. Uses 0G sealed inference for analysis inside TEE
3. Returns structured JSON analysis

## Arguments
- `$ARGUMENTS` — Name of the specialist to build (e.g., "sentiment", "whale", "momentum")

## Steps

1. **Check existing specialists** in `src/agents/specialist-server.ts` and `src/agents/prompts.ts`
2. **Create/update the system prompt** in `src/agents/prompts.ts` — optimized for 7B models (concise, structured, no ambiguity)
3. **Add the Express route** in `src/agents/specialist-server.ts`:
   - Port assignment: sentiment=4001, whale=4002, momentum=4003
   - x402 paywall middleware: `$0.001` per query
   - `/analyze` endpoint calling `sealedInference()` with the specialist prompt
4. **Create OpenClaw workspace** at `openclaw/{name}-agent/SOUL.md`
5. **Verify** the specialist compiles: `npx tsc --noEmit`
6. **Test** start the server and confirm HTTP 402 response

## Output
Report what was created/modified and the port assignment.
