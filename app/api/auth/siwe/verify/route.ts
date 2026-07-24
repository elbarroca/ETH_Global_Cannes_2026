import { NextResponse } from "next/server";
import { AuthError } from "@/src/auth/errors";
import { authErrorResponse } from "@/src/auth/http";
import { getAuthPolicy } from "@/src/auth/policy";
import { verifyAuthChallenge } from "@/src/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthError("AUTH_INVALID_REQUEST", "Malformed JSON body", 400);
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AuthError("AUTH_INVALID_REQUEST", "A JSON object is required", 400);
    }
    const input = body as Record<string, unknown>;
    const allowedKeys = new Set(["challengeId", "message", "signature"]);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      throw new AuthError("AUTH_INVALID_REQUEST", "Unexpected verification field", 400);
    }
    const policy = getAuthPolicy();
    const session = await verifyAuthChallenge(
      {
        challengeId: input.challengeId,
        message: input.message,
        signature: input.signature,
      },
      policy,
    );
    const response = NextResponse.json({
      authenticated: true,
      walletAddress: session.principal.walletAddress,
      userId: session.principal.userId,
      expiresAt: session.principal.expiresAt.toISOString(),
    });
    response.cookies.set({
      name: policy.sessionCookie,
      value: session.token,
      httpOnly: true,
      sameSite: "lax",
      secure: policy.secureCookie,
      path: "/",
      expires: session.principal.expiresAt,
    });
    return response;
  } catch (error) {
    return authErrorResponse(error, "auth.siwe.verify");
  }
}
