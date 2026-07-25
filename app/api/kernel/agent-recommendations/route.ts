import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import {
  foundingCatalogProjection,
  parseRecommendationRequest,
  recommendationFor,
} from "@/src/kernel/agent-catalog";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    if (!auth.auth.principal.userId) {
      return NextResponse.json(
        { error: "Onboarding required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      );
    }
    return NextResponse.json(foundingCatalogProjection());
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agent-recommendations.catalog");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    if (!auth.auth.principal.userId) {
      return NextResponse.json(
        { error: "Onboarding required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      );
    }
    const skills = parseRecommendationRequest(await readBoundedKernelJson(request));
    return NextResponse.json(recommendationFor(skills));
  } catch (error) {
    return kernelErrorResponse(error, "kernel.agent-recommendations");
  }
}
