import { createServer, type Server } from "node:http";
import { getDb } from "../config/database";

const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
const RELEASE_SHA = /^[0-9a-f]{40}$/;
const RAILWAY_CONTEXT_KEYS = [
  "RAILWAY_PROJECT_ID",
  "RAILWAY_ENVIRONMENT_ID",
  "RAILWAY_SERVICE_ID",
  "RAILWAY_DEPLOYMENT_ID",
] as const;

type LeaseKey = "goal-loop" | "kernel-worker";

export interface WorkerHealthOptions {
  goalRunnerOwnerId: string;
  kernelWorkerOwnerId: string;
  leaseSeconds: number;
  port?: number;
  host?: string;
  environment?: NodeJS.ProcessEnv;
  now?: () => Date;
  leaseReady?: (key: LeaseKey, ownerId: string, now: Date, leaseSeconds: number) => Promise<boolean>;
}

export interface WorkerHealthHandle {
  readonly port: number;
  stop: () => Promise<void>;
}

async function databaseLeaseReady(
  key: LeaseKey,
  ownerId: string,
  now: Date,
  leaseSeconds: number,
): Promise<boolean> {
  const earliestHeartbeat = new Date(now.getTime() - leaseSeconds * 1_000);
  const rows = await getDb()<{ ready: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM worker_leases
      WHERE key = ${key} AND owner_id = ${ownerId}
        AND heartbeat_at >= ${earliestHeartbeat} AND expires_at > ${now}
    ) AS ready
  `;
  return rows[0]?.ready === true;
}

function safeIdentifier(value: string | undefined): string | undefined {
  return value && IDENTIFIER.test(value) ? value : undefined;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") return 3_000;
  if (!/^\d{1,5}$/.test(value)) throw new Error("WORKER_HEALTH_PORT_INVALID");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("WORKER_HEALTH_PORT_INVALID");
  }
  return port;
}

function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (): void => reject(new Error("WORKER_HEALTH_LISTEN_FAILED"));
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("WORKER_HEALTH_LISTEN_FAILED"));
        return;
      }
      resolve(address.port);
    });
  });
}

export async function startWorkerHealth(options: WorkerHealthOptions): Promise<WorkerHealthHandle> {
  const environment = options.environment ?? process.env;
  const leaseReady = options.leaseReady ?? databaseLeaseReady;
  const now = options.now ?? (() => new Date());
  const railway = RAILWAY_CONTEXT_KEYS.some((key) => environment[key] !== undefined);
  const releaseSha = RELEASE_SHA.test(environment.RAILWAY_GIT_COMMIT_SHA ?? "")
    ? environment.RAILWAY_GIT_COMMIT_SHA as string
    : null;
  const serviceId = safeIdentifier(environment.RAILWAY_SERVICE_ID);
  const environmentId = safeIdentifier(environment.RAILWAY_ENVIRONMENT_ID);
  let available = true;

  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    if (request.method !== "GET" || request.url !== "/health") {
      response.writeHead(404).end('{"error":"NOT_FOUND"}');
      return;
    }

    const observedAt = now();
    const [goalRunnerReady, kernelWorkerReady] = available
      ? await Promise.all([
          leaseReady("goal-loop", options.goalRunnerOwnerId, observedAt, options.leaseSeconds)
            .catch(() => false),
          leaseReady("kernel-worker", options.kernelWorkerOwnerId, observedAt, options.leaseSeconds)
            .catch(() => false),
        ])
      : [false, false];
    const ready = available && goalRunnerReady && kernelWorkerReady && (!railway || releaseSha !== null);
    const body = {
      mode: "protected",
      goalRunnerReady,
      kernelWorkerReady,
      releaseSha,
      ...(serviceId ? { serviceId } : {}),
      ...(environmentId ? { environmentId } : {}),
    };
    response.writeHead(ready ? 200 : 503).end(JSON.stringify(body));
  });

  const port = await listen(
    server,
    options.port ?? parsePort(environment.PORT),
    options.host ?? "0.0.0.0",
  );
  let stopPromise: Promise<void> | null = null;
  return {
    port,
    stop: () => {
      if (stopPromise) return stopPromise;
      available = false;
      stopPromise = new Promise((resolve, reject) => {
        server.close((error) => error ? reject(new Error("WORKER_HEALTH_STOP_FAILED")) : resolve());
      });
      return stopPromise;
    },
  };
}
