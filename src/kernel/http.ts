import { NextResponse } from "next/server";
import { KernelError } from "./errors";

const MAX_KERNEL_JSON_BYTES = 8_192;

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
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
    ? error.message
    : "INTERNAL_ERROR";
  console.error(JSON.stringify({ level: "error", context, code }));
  return NextResponse.json({ error: "Request failed", code }, { status: 500 });
}
