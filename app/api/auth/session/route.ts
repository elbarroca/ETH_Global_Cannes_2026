import { NextResponse } from "next/server";
import { authErrorResponse, authenticateRequest, revokeRequestSession } from "@/src/auth/http";
import { getAuthPolicy } from "@/src/auth/policy";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const result = await authenticateRequest(request);
    if (!result.ok) return result.response;
    return NextResponse.json({
      authenticated: true,
      walletAddress: result.auth.principal.walletAddress,
      userId: result.auth.principal.userId,
      expiresAt: result.auth.principal.expiresAt.toISOString(),
    });
  } catch (error) {
    return authErrorResponse(error, "auth.session.read");
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    await revokeRequestSession(request);
    const policy = getAuthPolicy();
    const response = NextResponse.json({ authenticated: false });
    response.cookies.set({
      name: policy.sessionCookie,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: policy.secureCookie,
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return authErrorResponse(error, "auth.session.revoke");
  }
}
