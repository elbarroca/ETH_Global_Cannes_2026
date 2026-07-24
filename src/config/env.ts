const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

const OPTIONAL_HTTP_URLS = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_SITE_URL",
  "APP_URL",
  "OG_RPC_URL",
  "OG_STORAGE_INDEXER",
  "ARC_RPC_URL",
  "X402_FACILITATOR_URL",
  "COINGECKO_API_URL",
  "ETHERSCAN_API_URL",
  "FNG_API_URL",
] as const;

type EnvironmentSource = Record<string, string | undefined>;

export interface EnvironmentOptions {
  requireDatabase?: boolean;
}

export interface ValidatedEnvironment {
  nodeEnv: "development" | "test" | "production";
  databaseUrl?: string;
  directUrl?: string;
  serverPort: number;
  enableBackgroundWorkers: boolean;
  nextStartBot: boolean;
}

export class EnvironmentValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Environment validation failed: ${issues.join("; ")}`);
    this.name = "EnvironmentValidationError";
    this.issues = issues;
  }
}

function parseBoolean(
  key: string,
  value: string | undefined,
  fallback: boolean,
  issues: string[],
): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  issues.push(`${key}: expected "true" or "false"`);
  return fallback;
}

function parseInteger(
  key: string,
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  issues: string[],
): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value)) {
    issues.push(`${key}: expected an integer from ${min} to ${max}`);
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    issues.push(`${key}: expected an integer from ${min} to ${max}`);
    return fallback;
  }
  return parsed;
}

function parseUrl(
  key: string,
  value: string | undefined,
  protocols: ReadonlySet<string>,
  required: boolean,
  issues: string[],
): string | undefined {
  if (value === undefined || value === "") {
    if (required) issues.push(`${key}: required`);
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (!protocols.has(parsed.protocol)) {
      issues.push(`${key}: unsupported URL protocol`);
      return undefined;
    }
    if (
      POSTGRES_PROTOCOLS.has(parsed.protocol) &&
      (!parsed.hostname || !parsed.pathname || parsed.pathname === "/")
    ) {
      issues.push(`${key}: URL must include hostname and database name`);
      return undefined;
    }
    return value;
  } catch {
    issues.push(`${key}: invalid URL`);
    return undefined;
  }
}

export function validateEnvironment(
  source: EnvironmentSource = process.env,
  options: EnvironmentOptions = {},
): ValidatedEnvironment {
  const issues: string[] = [];
  const nodeEnv = source.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    issues.push("NODE_ENV: expected development, test, or production");
  }

  const databaseUrl = parseUrl(
    "DATABASE_URL",
    source.DATABASE_URL,
    POSTGRES_PROTOCOLS,
    options.requireDatabase === true,
    issues,
  );
  const directUrl = parseUrl(
    "DIRECT_URL",
    source.DIRECT_URL,
    POSTGRES_PROTOCOLS,
    options.requireDatabase === true,
    issues,
  );

  for (const key of OPTIONAL_HTTP_URLS) {
    parseUrl(key, source[key], HTTP_PROTOCOLS, false, issues);
  }

  const serverPort = parseInteger("SERVER_PORT", source.SERVER_PORT, 3001, 1, 65_535, issues);
  parseInteger("PORT", source.PORT, 3000, 1, 65_535, issues);
  parseInteger("OPENCLAW_GATEWAY_PORT", source.OPENCLAW_GATEWAY_PORT, 18789, 1, 65_535, issues);
  parseInteger("DEBATE_STAGE_DELAY_MS", source.DEBATE_STAGE_DELAY_MS, 0, 0, 600_000, issues);
  parseInteger(
    "DEBATE_DELIBERATION_PAUSE_MS",
    source.DEBATE_DELIBERATION_PAUSE_MS,
    0,
    0,
    600_000,
    issues,
  );

  const enableBackgroundWorkers = parseBoolean(
    "ENABLE_BACKGROUND_WORKERS",
    source.ENABLE_BACKGROUND_WORKERS,
    false,
    issues,
  );
  const nextStartBot = parseBoolean("NEXT_START_BOT", source.NEXT_START_BOT, false, issues);
  parseBoolean("USE_REMOTE_DEBATE", source.USE_REMOTE_DEBATE, false, issues);
  parseBoolean("USE_HIERARCHICAL_HIRING", source.USE_HIERARCHICAL_HIRING, false, issues);

  if (issues.length > 0) throw new EnvironmentValidationError(issues);

  return {
    nodeEnv: nodeEnv as ValidatedEnvironment["nodeEnv"],
    databaseUrl,
    directUrl,
    serverPort,
    enableBackgroundWorkers,
    nextStartBot,
  };
}

export function requireDatabaseUrl(source: EnvironmentSource = process.env): string {
  const issues: string[] = [];
  const databaseUrl = parseUrl("DATABASE_URL", source.DATABASE_URL, POSTGRES_PROTOCOLS, true, issues);
  if (!databaseUrl || issues.length > 0) throw new EnvironmentValidationError(issues);
  return databaseUrl;
}

export function withPrismaPoolParameters(databaseUrl: string): string {
  const issues: string[] = [];
  const validated = parseUrl("DATABASE_URL", databaseUrl, POSTGRES_PROTOCOLS, true, issues);
  if (!validated || issues.length > 0) throw new EnvironmentValidationError(issues);

  const url = new URL(validated);
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "20");
  return url.toString();
}

export function withoutPrismaPoolParameters(databaseUrl: string): string {
  const issues: string[] = [];
  const validated = parseUrl("DATABASE_URL", databaseUrl, POSTGRES_PROTOCOLS, true, issues);
  if (!validated || issues.length > 0) throw new EnvironmentValidationError(issues);

  const url = new URL(validated);
  url.searchParams.delete("connection_limit");
  url.searchParams.delete("pool_timeout");
  url.searchParams.delete("pgbouncer");
  return url.toString();
}

export function isLoopbackDatabaseUrl(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname.replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
