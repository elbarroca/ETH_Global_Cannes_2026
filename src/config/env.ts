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

export interface EnsPublicationDatabaseIdentity {
  url: string;
  username: string;
}

const RETIRED_A3_LIVE_SETTINGS = [
  "A3_0G_LIVE_ENABLED",
  "A3_0G_FUNDING_AUTHORIZED",
  "A3_0G_MAX_SPEND_ATOMIC",
  "A3_0G_SPEND_AUTHORIZATION",
] as const;

export interface EnvironmentOptions {
  requireDatabase?: boolean;
}

export interface ValidatedEnvironment {
  nodeEnv: "development" | "test" | "production";
  databaseUrl?: string;
  directUrl?: string;
  ensPublicationDatabaseUrl?: string;
  serverPort: number;
  runtimeMode: "protected" | "legacy";
  enableKernelWorker: boolean;
  kernelWorkerConcurrency: number;
  kernelWorkerLeaseSeconds: number;
  enableBackgroundWorkers: boolean;
  nextStartBot: boolean;
  siweDomain: string;
  siweUri: string;
  siweAudience: string;
  siweChainId: number;
  authChallengeTtlSeconds: number;
  authSessionTtlSeconds: number;
  authSessionCookie: string;
  strictA3: StrictA3Environment;
}

export type StrictA3Environment = { mode: "disabled" };

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

function parsePostgresUsername(
  key: string,
  value: string,
  required: boolean,
  issues: string[],
): string | undefined {
  const encoded = new URL(value).username;
  if (!encoded) {
    if (required) issues.push(`${key}: URL must include an explicit database login`);
    return undefined;
  }
  try {
    const username = decodeURIComponent(encoded).normalize("NFC");
    const bytes = new TextEncoder().encode(username).byteLength;
    if (!username || bytes > 63 || /[\u0000-\u001f\u007f]/u.test(username)) {
      issues.push(`${key}: invalid database login`);
      return undefined;
    }
    return username;
  } catch {
    issues.push(`${key}: invalid database login encoding`);
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
  const ensPublicationDatabaseUrl = parseUrl(
    "ENS_PUBLICATION_DATABASE_URL",
    source.ENS_PUBLICATION_DATABASE_URL,
    POSTGRES_PROTOCOLS,
    false,
    issues,
  );
  const databaseUsername = databaseUrl
    ? parsePostgresUsername("DATABASE_URL", databaseUrl, false, issues)
    : undefined;
  const directUsername = directUrl
    ? parsePostgresUsername("DIRECT_URL", directUrl, false, issues)
    : undefined;
  const publicationUsername = ensPublicationDatabaseUrl
    ? parsePostgresUsername(
        "ENS_PUBLICATION_DATABASE_URL",
        ensPublicationDatabaseUrl,
        true,
        issues,
      )
    : undefined;
  if (publicationUsername) {
    if (publicationUsername === databaseUsername || publicationUsername === directUsername) {
      issues.push("ENS_PUBLICATION_DATABASE_URL: must use a distinct restricted database login");
    }
  }

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
  const enableKernelWorker = parseBoolean(
    "ENABLE_KERNEL_WORKER",
    source.ENABLE_KERNEL_WORKER,
    false,
    issues,
  );
  const kernelWorkerConcurrency = parseInteger(
    "KERNEL_WORKER_CONCURRENCY",
    source.KERNEL_WORKER_CONCURRENCY,
    4,
    1,
    4,
    issues,
  );
  const kernelWorkerLeaseSeconds = parseInteger(
    "KERNEL_WORKER_LEASE_SECONDS",
    source.KERNEL_WORKER_LEASE_SECONDS,
    30,
    5,
    300,
    issues,
  );
  const nextStartBot = parseBoolean("NEXT_START_BOT", source.NEXT_START_BOT, false, issues);
  parseBoolean("USE_REMOTE_DEBATE", source.USE_REMOTE_DEBATE, false, issues);
  parseBoolean("USE_HIERARCHICAL_HIRING", source.USE_HIERARCHICAL_HIRING, false, issues);

  const runtimeMode = source.ALPHADAWG_RUNTIME_MODE ?? "protected";
  if (runtimeMode !== "protected" && runtimeMode !== "legacy") {
    issues.push("ALPHADAWG_RUNTIME_MODE: expected protected or legacy");
  }
  if (runtimeMode !== "legacy" && enableBackgroundWorkers) {
    issues.push("ENABLE_BACKGROUND_WORKERS: requires ALPHADAWG_RUNTIME_MODE=legacy");
  }

  const siweDomain = source.SIWE_DOMAIN ?? "localhost:3000";
  const siweUri = parseUrl(
    "SIWE_URI",
    source.SIWE_URI ?? "http://localhost:3000",
    HTTP_PROTOCOLS,
    true,
    issues,
  );
  const siweAudience = source.SIWE_AUDIENCE ?? "urn:alphadawg:kernel";
  if (!/^[A-Za-z0-9:._/-]{3,160}$/.test(siweAudience)) {
    issues.push("SIWE_AUDIENCE: expected a bounded audience identifier");
  }
  if (!/^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/.test(siweDomain)) {
    issues.push("SIWE_DOMAIN: expected an RFC 3986 authority");
  }
  const siweChainId = parseInteger(
    "SIWE_CHAIN_ID",
    source.SIWE_CHAIN_ID,
    5_042_002,
    1,
    2_147_483_647,
    issues,
  );
  const authChallengeTtlSeconds = parseInteger(
    "AUTH_CHALLENGE_TTL_SECONDS",
    source.AUTH_CHALLENGE_TTL_SECONDS,
    300,
    30,
    900,
    issues,
  );
  const authSessionTtlSeconds = parseInteger(
    "AUTH_SESSION_TTL_SECONDS",
    source.AUTH_SESSION_TTL_SECONDS,
    86_400,
    300,
    604_800,
    issues,
  );
  const authSessionCookie = source.AUTH_SESSION_COOKIE ?? "alphadawg_session";
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(authSessionCookie)) {
    issues.push("AUTH_SESSION_COOKIE: expected 3-64 URL-safe characters");
  }

  if (nodeEnv === "production") {
    if (!source.SIWE_DOMAIN) issues.push("SIWE_DOMAIN: required in production");
    if (!source.SIWE_URI) issues.push("SIWE_URI: required in production");
    if (!source.SIWE_AUDIENCE) issues.push("SIWE_AUDIENCE: required in production");
  }

  for (const key of RETIRED_A3_LIVE_SETTINGS) {
    if (source[key] !== undefined && source[key] !== "") {
      issues.push(`${key}: retired; production A3 live effects are unconditionally blocked`);
    }
  }
  const strictA3: StrictA3Environment = { mode: "disabled" };

  if (issues.length > 0) throw new EnvironmentValidationError(issues);

  return {
    nodeEnv: nodeEnv as ValidatedEnvironment["nodeEnv"],
    databaseUrl,
    directUrl,
    ensPublicationDatabaseUrl,
    serverPort,
    runtimeMode: runtimeMode as ValidatedEnvironment["runtimeMode"],
    enableKernelWorker,
    kernelWorkerConcurrency,
    kernelWorkerLeaseSeconds,
    enableBackgroundWorkers,
    nextStartBot,
    siweDomain,
    siweUri: siweUri as string,
    siweAudience,
    siweChainId,
    authChallengeTtlSeconds,
    authSessionTtlSeconds,
    authSessionCookie,
    strictA3,
  };
}

export function requireDatabaseUrl(source: EnvironmentSource = process.env): string {
  const issues: string[] = [];
  const databaseUrl = parseUrl("DATABASE_URL", source.DATABASE_URL, POSTGRES_PROTOCOLS, true, issues);
  if (!databaseUrl || issues.length > 0) throw new EnvironmentValidationError(issues);
  return databaseUrl;
}

export function requireEnsPublicationDatabaseUrl(
  source: EnvironmentSource = process.env,
): string {
  return requireEnsPublicationDatabaseIdentity(source).url;
}

export function requireEnsPublicationDatabaseIdentity(
  source: EnvironmentSource = process.env,
): EnsPublicationDatabaseIdentity {
  const issues: string[] = [];
  const publicationUrl = parseUrl(
    "ENS_PUBLICATION_DATABASE_URL",
    source.ENS_PUBLICATION_DATABASE_URL,
    POSTGRES_PROTOCOLS,
    true,
    issues,
  );
  const databaseUrl = parseUrl(
    "DATABASE_URL",
    source.DATABASE_URL,
    POSTGRES_PROTOCOLS,
    false,
    issues,
  );
  const directUrl = parseUrl(
    "DIRECT_URL",
    source.DIRECT_URL,
    POSTGRES_PROTOCOLS,
    false,
    issues,
  );
  const publicationUsername = publicationUrl
    ? parsePostgresUsername("ENS_PUBLICATION_DATABASE_URL", publicationUrl, true, issues)
    : undefined;
  const databaseUsername = databaseUrl
    ? parsePostgresUsername("DATABASE_URL", databaseUrl, false, issues)
    : undefined;
  const directUsername = directUrl
    ? parsePostgresUsername("DIRECT_URL", directUrl, false, issues)
    : undefined;
  if (publicationUsername) {
    if (publicationUsername === databaseUsername || publicationUsername === directUsername) {
      issues.push("ENS_PUBLICATION_DATABASE_URL: must use a distinct restricted database login");
    }
  }
  if (!publicationUrl || !publicationUsername || issues.length > 0) {
    throw new EnvironmentValidationError(issues);
  }
  return { url: publicationUrl, username: publicationUsername };
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
