import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  attachAgentWallet,
  createAgentDraft,
  getAgentCatalog,
  publishWalletAgentVersion,
} from "../../lib/api";

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
  assert.match(api, /createSiweChallenge\([\s\S]*action: SiweAction/);
  assert.match(context, /signForAction\("onboard"\)/);
  assert.match(context, /signForAction\("authenticate"\)/);
  assert.match(context, /WALLET_SIGNATURE_REJECTED: Signature canceled\. No authorization was granted\./);
  assert.match(guard, /Authorize workspace/);
  assert.match(guard, /Complete onboarding/);
  assert.match(wallet, /useSyncExternalStore/);
  assert.match(provider, /ssr: true/);
  assert.doesNotMatch(provider, /switchChain|addEthereumChain|ChainGuard/);
  assert.match(goals, /authState === "ready" && isOnboarded/);
  assert.match(marketplace, /enabled: ready/);
  assert.match(verify, /enabled: ready/);
  assert.match(creator, /useAccount\(\)/);
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

test("wallet-authority creator flow is bounded to inert prompt and approved stack input", async () => {
  const [api, creator, marketplace] = await Promise.all([
    readFile(`${root}/lib/api.ts`, "utf8"),
    readFile(`${root}/components/create-agent-modal.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
  ]);

  for (const stage of ["Identity + prompt", "Skills + MCP", "Agent wallet", "Publish + receipt"]) {
    assert.match(creator, new RegExp(stage.replace(/[+]/g, "\\+")));
  }
  assert.match(creator, /name\.trim\(\)\.length >= 2/);
  assert.match(creator, /description\.trim\(\)\.length >= 10/);
  assert.match(creator, /maxLength=\{4_000\}/);
  assert.match(creator, /INSTRUCTIONS_ACTIVE_CONTENT_REFUSED/);
  assert.match(creator, /HTML, images, URLs, active schemes, code fences, or shebangs/);
  assert.match(creator, /Generate with 0G/);
  assert.match(creator, /generateAgentInstructions/);
  assert.match(creator, /if \(generated\.fallback\)/);
  assert.match(creator, /0G unavailable; no generated prompt was applied/);
  assert.match(creator, /instructionsRefusal\(generated\.markdown\)/);
  assert.match(creator, /TEE verified/);
  assert.match(creator, /TEE unverified/);
  assert.match(creator, /capabilities\.length >= 1 && capabilities\.length <= 3/);
  assert.match(creator, /mcp\.length <= 4/);
  assert.match(creator, /pinned-deployment-lookup/);
  assert.match(creator, /liquidity-volume-snapshot/);
  assert.match(creator, /CONFIGURED means credentials are present or pending\. It never means a provider is live\./);
  assert.match(creator, /href="https:\/\/mcpmarket\.com\/" target="_blank" rel="noreferrer"/);
  assert.match(creator, /Discovery only\. External discoveries require review and server allowlisting before attachment\./);
  assert.match(creator, /Search approved agent stack/);
  assert.match(creator, /attachAgentWallet/);
  assert.match(creator, /publishWalletAgentVersion/);
  assert.match(creator, /WALLET_AUTHORIZED/);
  assert.match(creator, /walletPublicationDecisionId/);
  assert.match(creator, /walletReceiptHash/);
  assert.match(marketplace, /Database update required/);
  assert.match(marketplace, /required wallet-authority migration/);
  assert.doesNotMatch(creator, /bindAgentName|prepareAgentEnsWrite|publishAgentVersion|defaultCreatorParent|creatorParentOptions|mainnetEnsClient/);
  assert.doesNotMatch(marketplace, /defaultCreatorParent|creatorParentOptions|ownedCreatorParents/);
  assert.doesNotMatch(creator, /type="url"|GraphQL endpoint/);
  assert.doesNotMatch(creator, /htmlFor="[^"]*(?:endpoint|url|graphql|api-key|wallet-id)/i);
  assert.doesNotMatch(creator, /fetch\(["']https:\/\/mcpmarket\.com/);
  assert.match(api, /action: "ATTACH_AGENT_WALLET"/);
  assert.match(api, /action: "PUBLISH_WALLET_VERSION"/);
});

test("creator request bodies use only the protected wallet lifecycle actions", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ body: unknown; idempotencyKey: string | null }> = [];
  const bindingWithUiCopy = {
    provider: "the-graph",
    capability: "pinned-deployment-lookup",
    label: "Must not cross the boundary",
    description: "Must not cross the boundary",
  } as const;
  globalThis.fetch = async (_input, init) => {
    calls.push({
      body: JSON.parse(String(init?.body)) as unknown,
      idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
    });
    return new Response(JSON.stringify({ action: "OK", version: {} }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    await createAgentDraft({
      name: "Bounded research agent",
      description: "Reads approved market evidence only.",
      instructions: "## Task\n\nReturn concise evidence with explicit uncertainty.",
      capabilities: ["research", "market-analysis"],
      mcp: [bindingWithUiCopy],
    }, "draft-key");
    await attachAgentWallet("22222222-2222-4222-8222-222222222222", "wallet-key");
    await publishWalletAgentVersion("22222222-2222-4222-8222-222222222222", "publish-key");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls, [
    {
      body: {
        action: "CREATE_DRAFT",
        name: "Bounded research agent",
        description: "Reads approved market evidence only.",
        instructions: "## Task\n\nReturn concise evidence with explicit uncertainty.",
        capabilities: ["research", "market-analysis"],
        mcp: [{ provider: "the-graph", capability: "pinned-deployment-lookup" }],
      },
      idempotencyKey: "draft-key",
    },
    { body: { action: "ATTACH_AGENT_WALLET", versionId: "22222222-2222-4222-8222-222222222222" }, idempotencyKey: "wallet-key" },
    { body: { action: "PUBLISH_WALLET_VERSION", versionId: "22222222-2222-4222-8222-222222222222" }, idempotencyKey: "publish-key" },
  ]);
});

test("premium creator surfaces remain server-visible and evidence-conditional", async () => {
  const [landing, styles, nav, creator, marketplace] = await Promise.all([
    readFile(`${root}/app/page.tsx`, "utf8"),
    readFile(`${root}/app/globals.css`, "utf8"),
    readFile(`${root}/components/nav.tsx`, "utf8"),
    readFile(`${root}/components/create-agent-modal.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
  ]);
  assert.match(landing, /src="\/alphadawg-hero-dog\.png"/);
  assert.match(nav, /<DawgLogo[\s\S]*src="\/logo-square\.png"/);
  assert.match(styles, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  assert.match(creator, /data-testid="agent-stage"[\s\S]*tabIndex=\{-1\}/);
  assert.match(creator, /Provisioning does not fund, sign, submit a transaction/);
  assert.match(creator, /Runtime, 0G, Storage, job, delivery, and settlement remain per-job evidence\./);
  assert.match(marketplace, /Verified external hires/);
  assert.match(marketplace, /getOwnerEarnings/);
  assert.doesNotMatch([landing, nav, creator, marketplace].join("\n"), /[—–]/);
});

test("configured catalog responses remain strict and parseable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    categories: ["DATA"],
    skills: [{ id: "data.the-graph.read", category: "DATA", capabilities: [], constraints: ["read-only"], providerAvailability: "CONFIGURED" }],
    templates: [{ id: "liquidity-scout", label: "Liquidity Scout", capabilities: ["research", "market-analysis"], skillIds: ["data.the-graph.read"], priceAtomic: "1000" }],
    mcpProviders: [{ provider: "the-graph", availability: "CONFIGURED", capabilities: ["pinned-deployment-lookup", "liquidity-volume-snapshot"] }],
  }));
  try {
    const catalog = await getAgentCatalog();
    assert.equal(catalog.skills[0]?.providerAvailability, "CONFIGURED");
    assert.equal(catalog.mcpProviders[0]?.availability, "CONFIGURED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
