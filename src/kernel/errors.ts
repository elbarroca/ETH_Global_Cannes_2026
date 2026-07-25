export type KernelErrorCode =
  | "KERNEL_INVALID_REQUEST"
  | "KERNEL_UNSUPPORTED_MEDIA_TYPE"
  | "KERNEL_PAYLOAD_TOO_LARGE"
  | "KERNEL_FORBIDDEN"
  | "KERNEL_NOT_FOUND"
  | "KERNEL_CONFLICT"
  | "KERNEL_IDEMPOTENCY_MISMATCH"
  | "KERNEL_ILLEGAL_TRANSITION"
  | "KERNEL_IMMUTABLE_VERSION"
  | "KERNEL_ENS_AUTHORITY_REQUIRED"
  | "KERNEL_ENS_AUTHORITY_DENIED"
  | "A3_NOT_CONFIGURED"
  | "A6_CHAIN_NOT_AUTHORIZED"
  | "A6_TOKEN_NOT_ALLOWLISTED"
  | "A6_RECEIPT_IMMUTABLE"
  | "A6_QUOTE_EXPIRED"
  | "A6_CONFIRMATION_REQUIRED";

export class KernelError extends Error {
  readonly code: KernelErrorCode;
  readonly status: number;

  constructor(code: KernelErrorCode, message: string, status: number) {
    super(message);
    this.name = "KernelError";
    this.code = code;
    this.status = status;
  }
}
