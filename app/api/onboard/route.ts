import { NextResponse } from "next/server";
import { AuthError } from "@/src/auth/errors";
import { authErrorResponse, authenticateRequest } from "@/src/auth/http";
import { onboardVerifiedSession } from "@/src/auth/service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request, { requiredAction: "onboard" });
    if (!result.ok) return result.response;

    const text = await request.text();
    let body: Record<string, unknown> = {};
    if (text.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new AuthError("AUTH_INVALID_REQUEST", "Malformed JSON body", 400);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new AuthError("AUTH_INVALID_REQUEST", "A JSON object is required", 400);
      }
      body = parsed as Record<string, unknown>;
    }
    const allowedKeys = new Set(["walletAddress", "userId"]);
    if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
      throw new AuthError("AUTH_INVALID_REQUEST", "Unexpected onboarding field", 400);
    }
    if (
      body.walletAddress !== undefined &&
      (typeof body.walletAddress !== "string" ||
        body.walletAddress.toLowerCase() !== result.auth.principal.walletAddress)
    ) {
      throw new AuthError("AUTH_FORBIDDEN", "Wallet claim does not match the session", 403);
    }
    if (
      body.userId !== undefined &&
      (typeof body.userId !== "string" || body.userId !== result.auth.principal.userId)
    ) {
      throw new AuthError("AUTH_FORBIDDEN", "User claim does not match the session", 403);
    }

    const identity = await onboardVerifiedSession(result.auth.principal);
    const { generateLinkCode } = await import("@/src/store/link-codes");
    const telegramLinkCode = await generateLinkCode(identity.userId);
    return NextResponse.json(
      {
        userId: identity.userId,
        walletAddress: identity.walletAddress,
        proxyWalletAddress: null,
        telegramLinkCode,
        inftTokenId: null,
        existing: identity.existing,
      },
      { status: identity.existing ? 200 : 201 },
    );
  } catch (error) {
    return authErrorResponse(error, "onboard.verified");
  }
}
