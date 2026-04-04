import { NextResponse } from "next/server";
import { SWARM_AGENTS, type SwarmAgent } from "@/lib/swarm-endpoints";

export const dynamic = "force-dynamic";

// Per-agent timeouts. Fly.io auto-suspend can cold-start in 3-8s so we have to
// be patient: anything under 6s counts as "online", 6-10s counts as "waking"
// (amber), a full AbortController kill at 10s counts as "offline" (red).
const SOFT_TIMEOUT_MS = 6_000;
const HARD_TIMEOUT_MS = 10_000;

type SwarmHealthStatus = "online" | "waking" | "offline" | "timeout";

interface AgentHealth {
  name: string;
  role: SwarmAgent["role"];
  status: SwarmHealthStatus;
  latencyMs: number | null;
  error: string | null;
  lastChecked: string;
}

async function pingAgent(agent: SwarmAgent): Promise<AgentHealth> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const killer = setTimeout(() => controller.abort(), HARD_TIMEOUT_MS);

  try {
    const res = await fetch(`${agent.flyUrl}/healthz`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const latencyMs = Date.now() - startedAt;

    if (!res.ok) {
      return {
        name: agent.name,
        role: agent.role,
        status: "offline",
        latencyMs,
        error: `HTTP ${res.status}`,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name: agent.name,
      role: agent.role,
      status: latencyMs > SOFT_TIMEOUT_MS ? "waking" : "online",
      latencyMs,
      error: null,
      lastChecked: new Date().toISOString(),
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const aborted = (err as Error).name === "AbortError";
    return {
      name: agent.name,
      role: agent.role,
      status: aborted ? "timeout" : "offline",
      latencyMs: aborted ? null : latencyMs,
      error: aborted ? "hard timeout" : String((err as Error).message ?? err),
      lastChecked: new Date().toISOString(),
    };
  } finally {
    clearTimeout(killer);
  }
}

export async function GET(): Promise<NextResponse> {
  const results = await Promise.allSettled(SWARM_AGENTS.map(pingAgent));

  const agents: AgentHealth[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const spec = SWARM_AGENTS[i];
    return {
      name: spec.name,
      role: spec.role,
      status: "offline",
      latencyMs: null,
      error: String(r.reason),
      lastChecked: new Date().toISOString(),
    };
  });

  const summary = {
    total: agents.length,
    online: agents.filter((a) => a.status === "online").length,
    waking: agents.filter((a) => a.status === "waking").length,
    offline: agents.filter((a) => a.status === "offline" || a.status === "timeout").length,
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary,
    agents,
  });
}
