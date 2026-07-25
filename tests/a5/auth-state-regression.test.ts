import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("protected auth remains explicit, retryable, and fail-closed", async () => {
  const [context, guard, wallet, provider, goals, marketplace, verify] = await Promise.all([
    readFile(`${root}/contexts/user-context.tsx`, "utf8"),
    readFile(`${root}/components/auth-guard.tsx`, "utf8"),
    readFile(`${root}/components/wallet-connect.tsx`, "utf8"),
    readFile(`${root}/contexts/wagmi-provider.tsx`, "utf8"),
    readFile(`${root}/components/goal-workspace.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
    readFile(`${root}/app/verify/page.tsx`, "utf8"),
  ]);

  for (const state of ["disconnected", "signing", "onboarding", "ready", "stale", "error"]) {
    assert.match(context, new RegExp(`\\|? \\"${state}\\"`));
  }
  assert.match(context, /depth < 5/);
  assert.match(context, /current = record\.cause/);
  assert.match(context, /WALLET_SIGNATURE_REJECTED: Signature canceled\. Retry when ready\./);
  assert.match(context, /detail\?\.code === "AUTH_USER_REQUIRED"[\s\S]*setAuthState\("onboarding"\)/);
  assert.match(context, /detail\?\.status === 401 \|\| detail\?\.code === "AUTH_SESSION_EXPIRED"[\s\S]*setAuthState\("stale"\)/);
  assert.match(guard, /Retry SIWE/);
  assert.match(wallet, /useSyncExternalStore/);
  assert.match(provider, /ssr: true/);
  assert.doesNotMatch(provider, /switchChain|addEthereumChain|ChainGuard/);
  assert.match(goals, /authState === "ready" && isOnboarded/);
  assert.match(marketplace, /enabled: ready/);
  assert.match(verify, /enabled: ready/);
});

test("primary protected surfaces do not restore legacy polling", async () => {
  const sources = await Promise.all([
    readFile(`${root}/components/goal-workspace.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
    readFile(`${root}/app/verify/page.tsx`, "utf8"),
  ]);
  assert.doesNotMatch(sources.join("\n"), /api\/(?:swarm|cycle|marketplace\/earnings)|setInterval/);
});
