export type AuthErrorCode =
  | "AUTH_INVALID_REQUEST"
  | "AUTH_INVALID_WALLET"
  | "AUTH_INVALID_CHALLENGE"
  | "AUTH_CHALLENGE_EXPIRED"
  | "AUTH_CHALLENGE_REPLAYED"
  | "AUTH_INVALID_SIGNATURE"
  | "AUTH_MOCK_SIGNATURE_REJECTED"
  | "AUTH_REQUIRED"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_USER_REQUIRED"
  | "AUTH_FORBIDDEN";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode, message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

export function safeErrorCode(error: unknown): string {
  if (error instanceof AuthError) return error.code;
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)) {
    return error.message;
  }
  return "INTERNAL_ERROR";
}
