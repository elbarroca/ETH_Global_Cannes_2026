import { NextResponse } from "next/server";
import { AuthError } from "@/src/auth/errors";
import { authErrorResponse } from "@/src/auth/http";
import { getAuthPolicy, parseAuthAction } from "@/src/auth/policy";
import { createAuthChallenge } from "@/src/auth/service";

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
    const allowedKeys = new Set(["walletAddress", "action"]);
    if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
      throw new AuthError("AUTH_INVALID_REQUEST", "Unexpected challenge field", 400);
    }
    const action = parseAuthAction(input.action ?? "authenticate");
    const challenge = await createAuthChallenge(
      { walletAddress: input.walletAddress, action },
      getAuthPolicy(),
    );
    return NextResponse.json(
      {
        challengeId: challenge.id,
        message: challenge.message,
        expiresAt: challenge.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return authErrorResponse(error, "auth.siwe.challenge");
  }
}
