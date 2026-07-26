export type WalletProviderErrorReason =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "provider_response"
  | "provider_request"
  | "provider_failure";

const WALLET_PROVIDER_ERRORS = {
  invalid_request: {
    code: "KERNEL_WALLET_PROVIDER_INVALID_REQUEST",
    message: "Circle rejected the wallet request. Verify Circle TEST wallet-set, UNI-SEPOLIA, and SCA configuration.",
    status: 502,
  },
  unauthorized: {
    code: "KERNEL_WALLET_PROVIDER_UNAUTHORIZED",
    message: "Circle authentication failed. Verify Circle TEST entity-secret and account configuration.",
    status: 503,
  },
  forbidden: {
    code: "KERNEL_WALLET_PROVIDER_FORBIDDEN",
    message: "Circle wallet creation is forbidden. Verify Circle TEST entity-secret and account configuration.",
    status: 503,
  },
  provider_response: {
    code: "KERNEL_WALLET_PROVIDER_RESPONSE",
    message: "Circle returned an unavailable wallet response. Retry after verifying Circle TEST service status.",
    status: 502,
  },
  provider_request: {
    code: "KERNEL_WALLET_PROVIDER_REQUEST",
    message: "Circle wallet provider could not be reached. Retry after verifying Circle TEST connectivity.",
    status: 503,
  },
  provider_failure: {
    code: "KERNEL_WALLET_PROVIDER_UNAVAILABLE",
    message: "Circle wallet provider is unavailable. Retry after verifying Circle TEST configuration.",
    status: 503,
  },
} as const satisfies Record<
  WalletProviderErrorReason,
  { code: string; message: string; status: number }
>;

export type WalletProviderKernelErrorCode =
  typeof WALLET_PROVIDER_ERRORS[WalletProviderErrorReason]["code"];

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
  | WalletProviderKernelErrorCode
  | "A3_NOT_CONFIGURED"
  | "A6_CHAIN_NOT_AUTHORIZED"
  | "A6_TOKEN_NOT_ALLOWLISTED"
  | "A6_RECEIPT_IMMUTABLE"
  | "A6_QUOTE_EXPIRED"
  // Buyer confirmation cannot be verified: wallet-signed transaction-hash
  // verification is not implemented, so no confirmation value is acceptable.
  | "A6_CONFIRMATION_UNVERIFIABLE";

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

export function walletProviderKernelError(reason: WalletProviderErrorReason): KernelError {
  const error = WALLET_PROVIDER_ERRORS[reason];
  return new KernelError(error.code, error.message, error.status);
}

export function walletProviderKernelErrorFromCode(code: string): KernelError | null {
  const error = Object.values(WALLET_PROVIDER_ERRORS).find((value) => value.code === code);
  return error ? new KernelError(error.code, error.message, error.status) : null;
}
