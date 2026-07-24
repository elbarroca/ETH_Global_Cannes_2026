import { NextResponse } from "next/server";
import { validateEnvironment } from "../config/env";
import { AuthError, safeErrorCode } from "./errors";
import { getAuthPolicy } from "./policy";
import { getSessionPrincipal, revokeSession } from "./service";
import type { SessionPrincipal } from "./types";

export interface AuthenticatedRequest {
  principal: SessionPrincipal;
  token: string;
}

export type AuthResult =
  | { ok: true; auth: AuthenticatedRequest }
  | { ok: false; response: NextResponse };

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

export function extractSessionToken(request: Request): string | null {
  const policy = getAuthPolicy();
  const authorization = request.headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  const bearer = bearerMatch?.[1] ?? null;
  const cookie = cookieValue(request.headers.get("cookie"), policy.sessionCookie);
  if (bearer && cookie && bearer !== cookie) return null;
  return bearer ?? cookie;
}

export async function authenticateRequest(
  request: Request,
  options: { requireUser?: boolean; claimedUserId?: string | null } = {},
): Promise<AuthResult> {
  const token = extractSessionToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 },
      ),
    };
  }
  const principal = await getSessionPrincipal(token);
  if (!principal) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Session is invalid or expired", code: "AUTH_SESSION_EXPIRED" },
        { status: 401 },
      ),
    };
  }
  if (options.requireUser && !principal.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Verified onboarding is required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      ),
    };
  }
  if (
    options.claimedUserId &&
    (!principal.userId || options.claimedUserId !== principal.userId)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authenticated identity does not own this resource", code: "AUTH_FORBIDDEN" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, auth: { principal, token } };
}

export async function revokeRequestSession(request: Request): Promise<void> {
  const token = extractSessionToken(request);
  if (token) await revokeSession(token);
}

export function legacyRuntimeDisabledResponse(): NextResponse | null {
  const environment = validateEnvironment();
  if (environment.runtimeMode === "legacy") return null;
  return NextResponse.json(
    { error: "Legacy effect route is disabled", code: "A3_NOT_CONFIGURED" },
    { status: 503 },
  );
}

export function authErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const code = safeErrorCode(error);
  console.error(JSON.stringify({ level: "error", context, code }));
  return NextResponse.json({ error: "Request failed", code }, { status: 500 });
}
