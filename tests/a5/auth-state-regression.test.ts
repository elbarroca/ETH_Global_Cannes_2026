import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

test("protected auth remains explicit, retryable, and fail-closed", async () => {
  const [api, context, guard, wallet, provider, goals, marketplace, verify, creator] = await Promise.all([
    readFile(`${root}/lib/api.ts`, "utf8"),
    readFile(`${root}/contexts/user-context.tsx`, "utf8"),
    readFile(`${root}/components/auth-guard.tsx`, "utf8"),
    readFile(`${root}/components/wallet-connect.tsx`, "utf8"),
    readFile(`${root}/contexts/wagmi-provider.tsx`, "utf8"),
    readFile(`${root}/components/goal-workspace.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
    readFile(`${root}/app/verify/page.tsx`, "utf8"),
    readFile(`${root}/components/create-agent-modal.tsx`, "utf8"),
  ]);

  for (const state of ["disconnected", "signing", "onboarding", "ready", "stale", "error"]) {
    assert.match(context, new RegExp(`\\|? \\"${state}\\"`));
  }
  assert.match(context, /type InternalAuthState = AuthState \| "checking" \| "authorization-required" \| "signature-rejected"/);
  assert.match(context, /state === "checking"\) return "signing"/);
  assert.match(context, /state === "authorization-required"\) return "stale"/);
  assert.match(context, /state === "signature-rejected"\) return "error"/);
  assert.match(api, /createSiweChallenge\([\s\S]*action: SiweAction/);
  assert.match(api, /JSON\.stringify\(\{ walletAddress, action \}\)/);
  assert.match(context, /signForAction\("onboard"\)/);
  assert.match(context, /signForAction\("authenticate"\)/);
  assert.match(context, /setAuthState\("authorization-required"\)/);
  assert.match(context, /depth < 5/);
  assert.match(context, /current = record\.cause/);
  assert.match(context, /WALLET_SIGNATURE_REJECTED: Signature canceled\. No authorization was granted\./);
  assert.match(context, /detail\?\.code === "AUTH_ACTION_REQUIRED"[\s\S]*setAuthState\("authorization-required"\)/);
  assert.match(context, /detail\?\.code === "AUTH_USER_REQUIRED"[\s\S]*setAuthState\("onboarding"\)/);
  assert.match(context, /detail\?\.status === 401 \|\| detail\?\.code === "AUTH_SESSION_EXPIRED"[\s\S]*setAuthState\("stale"\)/);
  assert.match(guard, /Authorize workspace/);
  assert.match(guard, /Complete onboarding/);
  assert.match(guard, /Retry signature/);
  assert.match(wallet, /useSyncExternalStore/);
  assert.match(wallet, /readyConnector = hydrated \? connector : undefined/);
  assert.match(provider, /ssr: true/);
  assert.doesNotMatch(provider, /switchChain|addEthereumChain|ChainGuard/);
  assert.match(goals, /authState === "ready" && isOnboarded/);
  assert.match(marketplace, /enabled: ready/);
  assert.match(verify, /enabled: ready/);
  assert.match(creator, /getAgentCatalog/);
  assert.match(creator, /templateId: template\.id/);
  assert.doesNotMatch(creator, /Markdown instructions|Write manually|reviewedPromptDraft/);
});

test("primary protected surfaces do not restore legacy authority", async () => {
  const sources = await Promise.all([
    readFile(`${root}/components/goal-workspace.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
    readFile(`${root}/app/verify/page.tsx`, "utf8"),
    readFile(`${root}/components/create-agent-modal.tsx`, "utf8"),
  ]);
  const combined = sources.join("\n");
  assert.doesNotMatch(combined, /api\/(?:swarm|cycle|marketplace\/(?:earnings|create|leaderboard))|setInterval/);
  assert.doesNotMatch(combined, /\bhunt pack\b|\bELO\b|\bfake iNFT\b|\bArc funding\b/i);
});
