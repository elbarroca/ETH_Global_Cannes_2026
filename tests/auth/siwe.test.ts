import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { privateKeyToAccount } from "viem/accounts";
import { AuthError } from "../../src/auth/errors";
import { authenticateRequest, extractSessionToken } from "../../src/auth/http";
import { getAuthPolicy } from "../../src/auth/policy";
import {
  createAuthChallenge,
  getSessionPrincipal,
  sha256,
  verifyAuthChallenge,
} from "../../src/auth/service";
import { POST as onboardRoute } from "../../app/api/onboard/route";
import { POST as challengeRoute } from "../../app/api/auth/siwe/challenge/route";
import { POST as verifyRoute } from "../../app/api/auth/siwe/verify/route";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";

const PRIVATE_KEY = `0x${"11".repeat(32)}` as const;
const OTHER_PRIVATE_KEY = `0x${"22".repeat(32)}` as const;
const ACTION_PRIVATE_KEY = `0x${"33".repeat(32)}` as const;
const account = privateKeyToAccount(PRIVATE_KEY);
const otherAccount = privateKeyToAccount(OTHER_PRIVATE_KEY);
const actionAccount = privateKeyToAccount(ACTION_PRIVATE_KEY);
let database: DisposableDatabase;

before(async () => {
  database = await startDisposableDatabase("auth");
  configureDatabaseEnvironment(database.url);
});

after(async () => {
  await database.close();
});

test("challenge route rejects malformed JSON without persistence", async () => {
  const response = await challengeRoute(new Request("http://localhost:3000/api/auth/siwe/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(response.status, 400);
  const counts = await database.sql<{ count: string }[]>`SELECT count(*)::text AS count FROM auth_challenges`;
  assert.equal(counts[0]?.count, "0");
});

test("SIWE rejects every bound-field mutation and invalid signatures without mutation", async () => {
  const policy = getAuthPolicy();
  const challenge = await createAuthChallenge(
    { walletAddress: account.address, action: "onboard" },
    policy,
    { sql: database.sql },
  );
  const signature = await account.signMessage({ message: challenge.message });
  const mutations = [
    challenge.message.replace("Chain ID: 5042002", "Chain ID: 1"),
    challenge.message.replace("localhost:3000", "evil.example"),
    challenge.message.replace("Action=onboard", "Action=authenticate"),
    challenge.message.replace("urn:alphadawg:kernel", "urn:evil:audience"),
    challenge.message.replace("URI: http://localhost:3000", "URI: https://evil.example"),
  ];
  for (const message of mutations) {
    await assert.rejects(
      verifyAuthChallenge(
        { challengeId: challenge.id, message, signature },
        policy,
        { sql: database.sql },
      ),
      (error: unknown) => error instanceof AuthError && error.code === "AUTH_INVALID_CHALLENGE",
    );
  }
  const wrongSignature = await otherAccount.signMessage({ message: challenge.message });
  await assert.rejects(
    verifyAuthChallenge(
      { challengeId: challenge.id, message: challenge.message, signature: wrongSignature },
      policy,
      { sql: database.sql },
    ),
    (error: unknown) => error instanceof AuthError && error.code === "AUTH_INVALID_SIGNATURE",
  );
  const rows = await database.sql<{ consumed_at: Date | null; sessions: string }[]>`
    SELECT consumed_at, (SELECT count(*)::text FROM auth_sessions) AS sessions
    FROM auth_challenges WHERE id = ${challenge.id}::uuid
  `;
  assert.equal(rows[0]?.consumed_at, null);
  assert.equal(rows[0]?.sessions, "0");
});

test("expired and mock verification attempts are rejected without consumption", async () => {
  const policy = getAuthPolicy();
  const issuedAt = new Date("2026-07-24T00:00:00.000Z");
  const expired = await createAuthChallenge(
    { walletAddress: account.address, action: "onboard" },
    policy,
    { now: issuedAt, sql: database.sql },
  );
  const signature = await account.signMessage({ message: expired.message });
  await assert.rejects(
    verifyAuthChallenge(
      { challengeId: expired.id, message: expired.message, signature },
      policy,
      { now: new Date("2026-07-24T00:10:00.000Z"), sql: database.sql },
    ),
    (error: unknown) => error instanceof AuthError && error.code === "AUTH_CHALLENGE_EXPIRED",
  );
  const fresh = await createAuthChallenge(
    { walletAddress: account.address, action: "onboard" },
    policy,
    { sql: database.sql },
  );
  await assert.rejects(
    verifyAuthChallenge(
      { challengeId: fresh.id, message: fresh.message, signature: "mock" },
      policy,
      { sql: database.sql },
    ),
    (error: unknown) => error instanceof AuthError && error.code === "AUTH_MOCK_SIGNATURE_REJECTED",
  );
  const rows = await database.sql<{ consumed: string }[]>`
    SELECT count(*) FILTER (WHERE consumed_at IS NOT NULL)::text AS consumed
    FROM auth_challenges WHERE id IN (${expired.id}::uuid, ${fresh.id}::uuid)
  `;
  assert.equal(rows[0]?.consumed, "0");
});

test("valid verification consumes once and stores only the SHA-256 session token hash", async () => {
  const policy = getAuthPolicy();
  const challenge = await createAuthChallenge(
    { walletAddress: account.address, action: "onboard" },
    policy,
    { sql: database.sql },
  );
  const signature = await account.signMessage({ message: challenge.message });
  const verified = await verifyAuthChallenge(
    { challengeId: challenge.id, message: challenge.message, signature },
    policy,
    { sql: database.sql },
  );
  assert.match(verified.token, /^[A-Za-z0-9_-]{43}$/);
  const rows = await database.sql<{ token_hash: string; consumed_at: Date | null }[]>`
    SELECT s.token_hash, c.consumed_at
    FROM auth_sessions s JOIN auth_challenges c ON c.id = s.challenge_id
    WHERE s.id = ${verified.principal.sessionId}::uuid
  `;
  assert.equal(rows[0]?.token_hash, sha256(verified.token));
  assert.notEqual(rows[0]?.token_hash, verified.token);
  assert.ok(rows[0]?.consumed_at);
  assert.ok(await getSessionPrincipal(verified.token, { sql: database.sql }));
  await assert.rejects(
    verifyAuthChallenge(
      { challengeId: challenge.id, message: challenge.message, signature },
      policy,
      { sql: database.sql },
    ),
    (error: unknown) => error instanceof AuthError && error.code === "AUTH_CHALLENGE_REPLAYED",
  );

  const forged = await onboardRoute(new Request("http://localhost:3000/api/onboard", {
    method: "POST",
    headers: {
      authorization: `Bearer ${verified.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ walletAddress: otherAccount.address }),
  }));
  assert.equal(forged.status, 403);
  const before = await database.sql<{ count: string }[]>`SELECT count(*)::text AS count FROM users`;
  assert.equal(before[0]?.count, "0");

  const onboarded = await onboardRoute(new Request("http://localhost:3000/api/onboard", {
    method: "POST",
    headers: {
      authorization: `Bearer ${verified.token}`,
      "content-type": "application/json",
    },
    body: "{}",
  }));
  assert.equal(onboarded.status, 201);
  const payload = await onboarded.json() as { userId: string; walletAddress: string };
  assert.equal(payload.walletAddress, account.address.toLowerCase());
  const after = await database.sql<{
    users: string;
    sessions: string;
    proxy_wallet: Record<string, unknown>;
    inft_token_id: number | null;
    hot_wallet_index: number | null;
  }[]>`
    SELECT
      (SELECT count(*)::text FROM users) AS users,
      (SELECT count(*)::text FROM auth_sessions WHERE user_id = ${payload.userId}) AS sessions,
      proxy_wallet,
      inft_token_id,
      hot_wallet_index
    FROM users WHERE id = ${payload.userId}
  `;
  assert.deepEqual(after[0], {
    users: "1",
    sessions: "1",
    proxy_wallet: {},
    inft_token_id: null,
    hot_wallet_index: null,
  });
});

test("verification route issues an HttpOnly SameSite cookie without exposing its token", async () => {
  const policy = getAuthPolicy();
  const challenge = await createAuthChallenge(
    { walletAddress: otherAccount.address, action: "authenticate" },
    policy,
    { sql: database.sql },
  );
  const signature = await otherAccount.signMessage({ message: challenge.message });
  const response = await verifyRoute(new Request("http://localhost:3000/api/auth/siwe/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      challengeId: challenge.id,
      message: challenge.message,
      signature,
    }),
  }));
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, /^alphadawg_session=[A-Za-z0-9_-]{43};/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const token = cookie.match(/^alphadawg_session=([A-Za-z0-9_-]{43});/)?.[1];
  assert.ok(token);
  const payload = await response.json() as Record<string, unknown>;
  assert.equal("token" in payload, false);
  const rows = await database.sql<{ token_hash: string }[]>`
    SELECT token_hash FROM auth_sessions WHERE challenge_id = ${challenge.id}::uuid
  `;
  assert.equal(rows[0]?.token_hash, sha256(token));
});

test("authenticate sessions cannot onboard while an onboard authorization can", async () => {
  const policy = getAuthPolicy();
  const authenticateChallenge = await createAuthChallenge(
    { walletAddress: actionAccount.address, action: "authenticate" },
    policy,
    { sql: database.sql },
  );
  const authenticateSignature = await actionAccount.signMessage({
    message: authenticateChallenge.message,
  });
  const authenticated = await verifyAuthChallenge(
    {
      challengeId: authenticateChallenge.id,
      message: authenticateChallenge.message,
      signature: authenticateSignature,
    },
    policy,
    { sql: database.sql },
  );
  const rejected = await onboardRoute(new Request("http://localhost:3000/api/onboard", {
    method: "POST",
    headers: {
      authorization: `Bearer ${authenticated.token}`,
      "content-type": "application/json",
    },
    body: "{}",
  }));
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json() as { code: string }).code, "AUTH_ACTION_REQUIRED");
  const before = await database.sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM users WHERE wallet_address = ${actionAccount.address.toLowerCase()}
  `;
  assert.equal(before[0]?.count, "0");

  const onboardChallenge = await createAuthChallenge(
    { walletAddress: actionAccount.address, action: "onboard" },
    policy,
    { sql: database.sql },
  );
  const onboardSignature = await actionAccount.signMessage({ message: onboardChallenge.message });
  const onboardAuthorization = await verifyAuthChallenge(
    {
      challengeId: onboardChallenge.id,
      message: onboardChallenge.message,
      signature: onboardSignature,
    },
    policy,
    { sql: database.sql },
  );
  const accepted = await onboardRoute(new Request("http://localhost:3000/api/onboard", {
    method: "POST",
    headers: {
      authorization: `Bearer ${onboardAuthorization.token}`,
      "content-type": "application/json",
    },
    body: "{}",
  }));
  assert.equal(accepted.status, 201);
  assert.equal(
    (await accepted.json() as { walletAddress: string }).walletAddress,
    actionAccount.address.toLowerCase(),
  );

  const protectedWithOnboard = await authenticateRequest(new Request("http://localhost:3000", {
    headers: { authorization: `Bearer ${onboardAuthorization.token}` },
  }), { requireUser: true });
  assert.equal(protectedWithOnboard.ok, false);
  if (protectedWithOnboard.ok) throw new Error("TEST_ONBOARD_SESSION_UNEXPECTEDLY_AUTHORIZED");
  assert.equal(protectedWithOnboard.response.status, 403);

  const freshChallenge = await createAuthChallenge(
    { walletAddress: actionAccount.address, action: "authenticate" },
    policy,
    { sql: database.sql },
  );
  const freshSignature = await actionAccount.signMessage({ message: freshChallenge.message });
  const freshAuthorization = await verifyAuthChallenge(
    {
      challengeId: freshChallenge.id,
      message: freshChallenge.message,
      signature: freshSignature,
    },
    policy,
    { sql: database.sql },
  );
  const protectedWithFreshAuth = await authenticateRequest(new Request("http://localhost:3000", {
    headers: { authorization: `Bearer ${freshAuthorization.token}` },
  }), { requireUser: true });
  assert.equal(protectedWithFreshAuth.ok, true);
});

test("malformed percent-encoded session cookies fail closed without mutation", async () => {
  const before = await database.sql<{ users: string; sessions: string }[]>`
    SELECT
      (SELECT count(*)::text FROM users) AS users,
      (SELECT count(*)::text FROM auth_sessions) AS sessions
  `;
  const request = new Request("http://localhost:3000/api/onboard", {
    method: "POST",
    headers: {
      cookie: "alphadawg_session=%E0%A4%A",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(extractSessionToken(request), null);
  const response = await onboardRoute(request);
  assert.equal(response.status, 401);
  assert.equal((await response.json() as { code: string }).code, "AUTH_REQUIRED");
  const after = await database.sql<{ users: string; sessions: string }[]>`
    SELECT
      (SELECT count(*)::text FROM users) AS users,
      (SELECT count(*)::text FROM auth_sessions) AS sessions
  `;
  assert.deepEqual(after[0], before[0]);
});
