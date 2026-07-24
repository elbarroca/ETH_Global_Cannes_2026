import { NextResponse } from "next/server";
import { KernelError } from "./errors";

export function kernelErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof KernelError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
    ? error.message
    : "INTERNAL_ERROR";
  console.error(JSON.stringify({ level: "error", context, code }));
  return NextResponse.json({ error: "Request failed", code }, { status: 500 });
}
