import "dotenv/config";

const GATEWAY_PORT = parseInt(process.env.OPENCLAW_GATEWAY_PORT ?? "18789", 10);
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN ?? "";
const GATEWAY_URL = `http://127.0.0.1:${GATEWAY_PORT}`;

if (!GATEWAY_TOKEN) {
  console.warn("[openclaw] OPENCLAW_GATEWAY_TOKEN not set — gateway requests will be unauthenticated");
}

export interface SessionsSendResult {
  content: string;
  runId?: string;
  status: "ok" | "timeout" | "queued" | "error";
  error?: string;
}

interface AgentInfo {
  id: string;
  name: string;
  status: string;
}

// ── OpenClaw Gateway HTTP client ──────────────────────────────────────────────
// Drives agent-to-agent communication via POST /tools/invoke
// sessions_send must be in gateway.tools.allow in openclaw.json

export class OpenClawGateway {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = baseUrl ?? GATEWAY_URL;
    this.token = token ?? GATEWAY_TOKEN;
  }

  private async invoke<T>(tool: string, args: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(`${this.baseUrl}/tools/invoke`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tool, args }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gateway ${res.status}: ${body}`);
      }

      return (await res.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Send a message to a target agent session and wait for reply
  async sessionsSend(
    targetAgent: string,
    message: string,
    timeoutSeconds: number = 30,
  ): Promise<SessionsSendResult> {
    const sessionKey = `agent:${targetAgent}:main`;

    try {
      const result = await this.invoke<{
        ok?: boolean;
        result?: { runId?: string; status?: string; reply?: string };
        error?: string;
      }>("sessions_send", {
        sessionKey,
        message,
        timeoutSeconds,
      });

      if (result.error) {
        return { content: "", status: "error", error: result.error };
      }

      return {
        content: result.result?.reply ?? "",
        runId: result.result?.runId,
        status: (result.result?.status as SessionsSendResult["status"]) ?? "ok",
      };
    } catch (err) {
      // Retry once on connection refused (Gateway may be starting up)
      if (err instanceof Error && (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed"))) {
        console.warn("[openclaw] Gateway connection failed, retrying in 2s...");
        await new Promise((r) => setTimeout(r, 2000));

        try {
          const retry = await this.invoke<{
            ok?: boolean;
            result?: { runId?: string; status?: string; reply?: string };
            error?: string;
          }>("sessions_send", { sessionKey, message, timeoutSeconds });

          return {
            content: retry.result?.reply ?? "",
            runId: retry.result?.runId,
            status: (retry.result?.status as SessionsSendResult["status"]) ?? "ok",
          };
        } catch (retryErr) {
          return {
            content: "",
            status: "error",
            error: `Gateway unreachable after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
          };
        }
      }

      return {
        content: "",
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // List all registered agents
  async listAgents(): Promise<AgentInfo[]> {
    try {
      const result = await this.invoke<{ result?: AgentInfo[] }>("sessions_list", {});
      return result.result ?? [];
    } catch {
      return [];
    }
  }

  // Check if Gateway is reachable
  async ping(): Promise<boolean> {
    try {
      const agents = await this.listAgents();
      return agents.length > 0;
    } catch {
      return false;
    }
  }
}

// Singleton — lazy init
let _gateway: OpenClawGateway | null = null;

export function getGateway(): OpenClawGateway {
  if (!_gateway) {
    _gateway = new OpenClawGateway();
  }
  return _gateway;
}
