export type KernelErrorCode =
  | "KERNEL_INVALID_REQUEST"
  | "KERNEL_FORBIDDEN"
  | "KERNEL_NOT_FOUND"
  | "KERNEL_CONFLICT"
  | "KERNEL_IDEMPOTENCY_MISMATCH"
  | "KERNEL_ILLEGAL_TRANSITION"
  | "KERNEL_IMMUTABLE_VERSION"
  | "KERNEL_ENS_AUTHORITY_REQUIRED"
  | "KERNEL_ENS_AUTHORITY_DENIED"
  | "A3_NOT_CONFIGURED";

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
