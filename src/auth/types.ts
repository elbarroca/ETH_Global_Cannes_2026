export const AUTH_ACTIONS = ["authenticate", "onboard"] as const;

export type AuthAction = (typeof AUTH_ACTIONS)[number];

export interface AuthPolicy {
  domain: string;
  uri: string;
  audience: string;
  chainId: number;
  challengeTtlSeconds: number;
  sessionTtlSeconds: number;
  sessionCookie: string;
  secureCookie: boolean;
}

export interface AuthChallengeRecord {
  id: string;
  message: string;
  messageHash: string;
  walletAddress: `0x${string}`;
  domain: string;
  chainId: number;
  action: AuthAction;
  nonce: string;
  audience: string;
  uri: string;
  issuedAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface SessionPrincipal {
  sessionId: string;
  walletAddress: `0x${string}`;
  userId: string | null;
  action: AuthAction;
  expiresAt: Date;
}
