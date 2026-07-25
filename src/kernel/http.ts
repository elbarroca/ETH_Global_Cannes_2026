import { NextResponse } from "next/server";
import { KernelError } from "./errors";

const MAX_KERNEL_JSON_BYTES = 8_192;
const SCHEMA_NOT_READY_SQLSTATES = new Set(["42P01", "42703"]);
const SAFE_LOG_CONTEXT = /^[a-z][a-z0-9.-]{0,63}$/;

function schemaNotReadySqlState(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = error.code;
  return typeof code === "string" && SCHEMA_NOT_READY_SQLSTATES.has(code) ? code : null;
}

function safeLogContext(context: string): string {
  return SAFE_LOG_CONTEXT.test(context) ? context : "kernel.request";
}

export async function readBoundedKernelJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new KernelError(
      "KERNEL_UNSUPPORTED_MEDIA_TYPE",
      "Content-Type must be application/json",
      415,
    );
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Invalid Content-Length", 400);
    }
    if (Number(contentLength) > MAX_KERNEL_JSON_BYTES) {
      throw new KernelError("KERNEL_PAYLOAD_TOO_LARGE", "Request body is too large", 413);
    }
  }
  if (!request.body) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "A JSON body is required", 400);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let failure: KernelError | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_KERNEL_JSON_BYTES) {
        failure = new KernelError(
          "KERNEL_PAYLOAD_TOO_LARGE",
          "Request body is too large",
          413,
        );
        break;
      }
      chunks.push(value);
    }
  } catch {
    failure = new KernelError("KERNEL_INVALID_REQUEST", "Request body could not be read", 400);
  } finally {
    if (failure?.code === "KERNEL_PAYLOAD_TOO_LARGE") {
      try {
        await reader.cancel();
      } catch {
        // Cancellation is best-effort cleanup; it cannot replace the bounded 413.
      }
    }
    try {
      reader.releaseLock();
    } catch {
      failure ??= new KernelError("KERNEL_INVALID_REQUEST", "Request body could not be read", 400);
    }
  }
  if (failure) throw failure;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text) throw new Error("empty");
    return JSON.parse(text) as unknown;
  } catch {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Malformed JSON body", 400);
  }
}

export function kernelErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof KernelError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const schemaNotReady = schemaNotReadySqlState(error) !== null;
  const code = schemaNotReady ? "KERNEL_SCHEMA_NOT_READY" : "INTERNAL_ERROR";
  console.error(JSON.stringify({ level: "error", context: safeLogContext(context), code }));
  return NextResponse.json(
    { error: schemaNotReady ? "Service temporarily unavailable" : "Request failed", code },
    { status: schemaNotReady ? 503 : 500 },
  );
}
