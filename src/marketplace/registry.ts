// Specialist marketplace registry — in-memory Map backed by Prisma persistence

import { getPrisma } from "../config/prisma";
import { logAction } from "../store/action-logger";
import { deriveSpecialistAddress } from "../config/wallets";
import type { SpecialistResult } from "../types/index";

interface AgentRecord {
  id: string;
  name: string;
  endpoint: string;
  price: string;
  tags: string[];
  reputation: number;
  totalHires: number;
  correctCalls: number;
  active: boolean;
  walletAddress?: string;
}

interface DiscoverOptions {
  tags?: string[];
  minReputation?: number;
  maxHires?: number;
}

// In-memory registry for fast lookups
const agents = new Map<string, AgentRecord>();
let registryLoaded = false;
let registryLoadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (registryLoaded) return;
  if (registryLoadPromise) return registryLoadPromise;
  registryLoadPromise = loadRegistry().catch((err) => {
    registryLoadPromise = null;
    throw err;
  });
  return registryLoadPromise;
}

// ── Load from Prisma on boot ─────────────────────────────────

export async function loadRegistry(): Promise<void> {
  const prisma = getPrisma();
  const rows = await prisma.marketplaceAgent.findMany({ where: { active: true } });
  for (const row of rows) {
    agents.set(row.name, {
      id: row.id,
      name: row.name,
      endpoint: row.endpoint,
      price: row.price,
      tags: row.tags,
      reputation: row.reputation,
      totalHires: row.totalHires,
      correctCalls: row.correctCalls,
      active: row.active,
      walletAddress: row.walletAddress ?? undefined,
    });
  }
  console.log(`[registry] Loaded ${agents.size} agents from database`);

  // Auto-register built-in specialists if missing
  await registerBuiltins();
  registryLoaded = true;
}

// ── Register a specialist (upsert) ──────────────────────────

export async function registerSpecialist(
  name: string,
  endpoint: string,
  tags: string[],
  price = "$0.001",
  walletAddress?: string,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.marketplaceAgent.upsert({
    where: { name },
    update: { endpoint, tags, price, active: true, ...(walletAddress ? { walletAddress } : {}) },
    create: { name, endpoint, tags, price, ...(walletAddress ? { walletAddress } : {}) },
  });
  agents.set(name, {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    price: row.price,
    tags: row.tags,
    reputation: row.reputation,
    totalHires: row.totalHires,
    correctCalls: row.correctCalls,
    active: row.active,
    walletAddress: row.walletAddress ?? undefined,
  });
}

// ── Discover specialists by criteria ────────────────────────

export async function discoverSpecialists(options: DiscoverOptions = {}): Promise<AgentRecord[]> {
  await ensureLoaded();
  const { tags, minReputation = 0, maxHires = 10 } = options;
  const matches: AgentRecord[] = [];

  for (const agent of agents.values()) {
    if (!agent.active) continue;
    if (agent.reputation < minReputation) continue;
    if (tags && tags.length > 0) {
      const hasTag = tags.some((t) => agent.tags.includes(t));
      if (!hasTag) continue;
    }
    matches.push(agent);
  }

  // Ensure tag diversity: pick best agent per tag first, then fill remaining slots
  const sorted = matches.sort((a, b) => b.reputation - a.reputation);
  const picked: AgentRecord[] = [];
  const tagsCovered = new Set<string>();

  // First pass: one agent per requested tag
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      const best = sorted.find((a) => a.tags.includes(tag) && !picked.includes(a));
      if (best) {
        picked.push(best);
        best.tags.forEach((t) => tagsCovered.add(t));
      }
    }
  }

  // Second pass: fill remaining slots with highest reputation
  for (const agent of sorted) {
    if (picked.length >= maxHires) break;
    if (!picked.includes(agent)) picked.push(agent);
  }

  return picked.slice(0, maxHires);
}

// ── Hire from marketplace (discover + pay + collect) ────────

export async function hireFromMarketplace(
  payFetch: typeof fetch,
  userId: string,
  options: DiscoverOptions = {},
): Promise<SpecialistResult[]> {
  const discovered = await discoverSpecialists(options);
  if (discovered.length === 0) {
    throw new Error("No specialists found matching criteria");
  }

  const results: SpecialistResult[] = [];
  const prisma = getPrisma();

  for (const agent of discovered) {
    const MAX_RETRIES = 2;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const t0 = Date.now();
      try {
        const res = await payFetch(agent.endpoint);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`${agent.name} returned ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as SpecialistResult;

        // Attach reputation to result
        const result: SpecialistResult = {
          ...data,
          name: agent.name,
          reputation: agent.reputation,
        };
        results.push(result);

        // Increment totalHires in DB + memory
        agent.totalHires += 1;
        await prisma.marketplaceAgent.update({
          where: { id: agent.id },
          data: { totalHires: { increment: 1 } },
        });

        await logAction({
          userId,
          actionType: "SPECIALIST_HIRED",
          agentName: agent.name,
          attestationHash: data.attestationHash,
          teeVerified: data.teeVerified,
          paymentAmount: agent.price,
          paymentNetwork: "arc",
          durationMs: Date.now() - t0,
          payload: { signal: data.signal, confidence: data.confidence, reputation: agent.reputation },
        });

        lastError = null;
        break; // Success — no retry needed
      } catch (err) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[registry] Attempt ${attempt}/${MAX_RETRIES} to hire ${agent.name} failed: ${errMsg}`);

        if (attempt < MAX_RETRIES) {
          // Wait 1s before retry
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    if (lastError) {
      await logAction({
        userId,
        actionType: "SPECIALIST_HIRED",
        agentName: agent.name,
        status: "failed",
        payload: { error: String(lastError), retries: MAX_RETRIES },
        durationMs: 0,
      }).catch(() => {});
      console.warn(`[registry] All ${MAX_RETRIES} attempts to hire ${agent.name} failed`);
    }
  }

  return results;
}

// ── Fetch reputation snapshot ───────────────────────────────
//
// Returns a plain { name → reputation } map read from the in-memory registry.
// Used by main-agent at the top of runCycle() to feed specialist rotation —
// each cycle picks the best N of a role's pool using these scores plus
// context boosts and deterministic jitter. See role-manifests.ts:selectForRole.

export async function getReputationScores(): Promise<Record<string, number>> {
  await ensureLoaded();
  const out: Record<string, number> = {};
  for (const agent of agents.values()) {
    out[agent.name] = agent.reputation;
  }
  return out;
}

// ── Increment hire count for an agent ─────────────────────

export async function incrementAgentHires(name: string): Promise<void> {
  const agent = agents.get(name);
  if (!agent) return;

  agent.totalHires += 1;
  const prisma = getPrisma();
  await prisma.marketplaceAgent.update({
    where: { id: agent.id },
    data: { totalHires: { increment: 1 } },
  }).catch(() => {});
}

// ── Auto-register built-in specialists ──────────────────────

async function registerBuiltins(): Promise<void> {
  const builtins = [
    { name: "sentiment", endpoint: "http://localhost:4001/analyze", tags: ["sentiment"], specIndex: 0 },
    { name: "whale", endpoint: "http://localhost:4002/analyze", tags: ["whale"], specIndex: 1 },
    { name: "momentum", endpoint: "http://localhost:4003/analyze", tags: ["momentum"], specIndex: 2 },
    { name: "memecoin-hunter", endpoint: "http://localhost:4004/analyze", tags: ["memecoin", "degen", "new-pairs"], specIndex: 3 },
    { name: "twitter-alpha", endpoint: "http://localhost:4005/analyze", tags: ["social", "twitter", "narrative"], specIndex: 4 },
    { name: "defi-yield", endpoint: "http://localhost:4006/analyze", tags: ["defi", "yield", "tvl"], specIndex: 5 },
    { name: "news-scanner", endpoint: "http://localhost:4007/analyze", tags: ["news", "regulatory", "listings"], specIndex: 6 },
    { name: "onchain-forensics", endpoint: "http://localhost:4008/analyze", tags: ["onchain", "forensics", "wallets"], specIndex: 7 },
    { name: "options-flow", endpoint: "http://localhost:4009/analyze", tags: ["options", "derivatives", "volatility"], specIndex: 8 },
    { name: "macro-correlator", endpoint: "http://localhost:4010/analyze", tags: ["macro", "correlation", "tradfi"], specIndex: 9 },
  ];
  for (const b of builtins) {
    if (!agents.has(b.name)) {
      let wallet: string | undefined;
      try {
        wallet = deriveSpecialistAddress(b.specIndex);
      } catch {
        // AGENT_MNEMONIC not set — skip wallet derivation (non-fatal)
      }
      await registerSpecialist(b.name, b.endpoint, b.tags, "$0.001", wallet);
      console.log(`[registry] Registered built-in: ${b.name}${wallet ? ` (wallet: ${wallet.slice(0, 10)}...)` : ""}`);
    }
  }
}
