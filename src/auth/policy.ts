import { validateEnvironment } from "../config/env";
import { AuthError } from "./errors";
import { AUTH_ACTIONS, type AuthAction, type AuthPolicy } from "./types";

export function parseAuthAction(value: unknown): AuthAction {
  if (typeof value === "string" && AUTH_ACTIONS.includes(value as AuthAction)) {
    return value as AuthAction;
  }
  throw new AuthError("AUTH_INVALID_REQUEST", "Unsupported authentication action", 400);
}

export function getAuthPolicy(
  source: Record<string, string | undefined> = process.env,
): AuthPolicy {
  const environment = validateEnvironment(source);
  return {
    domain: environment.siweDomain,
    uri: environment.siweUri,
    audience: environment.siweAudience,
    chainId: environment.siweChainId,
    challengeTtlSeconds: environment.authChallengeTtlSeconds,
    sessionTtlSeconds: environment.authSessionTtlSeconds,
    sessionCookie: environment.authSessionCookie,
    secureCookie: environment.nodeEnv === "production",
  };
}

export function authStatement(action: AuthAction, audience: string): string {
  return `AlphaDawg authorization. Action=${action}; Audience=${audience}`;
}

export function authResources(policy: AuthPolicy, action: AuthAction): readonly string[] {
  const base = policy.uri.endsWith("/") ? policy.uri.slice(0, -1) : policy.uri;
  return [
    `${base}/auth/action/${action}`,
    `${base}/auth/audience/${encodeURIComponent(policy.audience)}`,
  ];
}
