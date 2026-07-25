import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getAgentCatalog } from "../../lib/api";

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

test("creation wizard explains locked catalog capabilities and canonical ENS preview", async () => {
  const [creator, marketplace] = await Promise.all([
    readFile(`${root}/components/create-agent-modal.tsx`, "utf8"),
    readFile(`${root}/app/marketplace/page.tsx`, "utf8"),
  ]);

  for (const icon of ["BrainIcon", "DatabaseIcon", "LightningIcon", "PlugsConnectedIcon"]) {
    assert.match(creator, new RegExp(icon));
  }
  for (const explanation of [
    "The role and reasoning stance the agent follows.",
    "Read-only sources the protected runtime may query.",
    "Bounded proposals the agent may prepare without signing.",
    "Required protected compute and storage rails.",
  ]) {
    assert.match(creator, new RegExp(explanation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(creator, /defaultCreatorParent/);
  assert.match(marketplace, /filter\(\(agent\) => agent\.canonicalState === "CANONICAL"\)/);
  assert.match(marketplace, /defaultCreatorParent=\{defaultCreatorParent\}/);
  assert.match(marketplace, /creatorParentOptions=\{ownedCreatorParents\}/);
  assert.match(creator, /`\$\{agentLabel\}\.\$\{normalizedCreatorParent\}`/);
  assert.match(creator, /CREATOR_PARENT_REQUIRED: No wallet-derived ENS parent was substituted\./);
  assert.doesNotMatch(creator, /\.creator\.eth/);
  assert.doesNotMatch(creator, /skillIds:\s*|mcpBindings:\s*/);
  assert.match(creator, /useAccount\(\)/);
  assert.match(creator, /mainnetEnsClient\.getEnsName\(\{ address, strict: false \}\)/);
  assert.match(creator, /!creatorParentEditedRef\.current && !defaultCreatorParent/);
  assert.match(creator, /PREPARE_ENS_WRITE and server A4 authority checks remain decisive\./);
  assert.match(creator, /href="https:\/\/app\.ens\.domains\/" target="_blank" rel="noreferrer"/);
  assert.match(creator, />Check again<\/button>/);
  assert.match(creator, /Its ETH Address must match this connected wallet; set it as Primary or enter it manually\./);
  assert.match(creator, /No verified mainnet Primary Name found\./);
  assert.match(creator, /ENS lookup failed; enter your \.eth parent manually or retry\./);
  assert.doesNotMatch(creator, /barrocaa\.eth/);
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
  assert.match(landing, /Choose a goal, hire a reviewed agent, and inspect the result and proof\./);
  assert.match(landing, /You earn only when another user hires it and receipt-backed settlement succeeds\./);
  assert.match(landing, /A hire count alone is not payment evidence\. AlphaDawg does not estimate future earnings\./);
  assert.doesNotMatch(landing, /HeroVisual|<Reveal|0G Compute[\s\S]*Every model call|Hedera HCS|Arc x402/);
  assert.match(nav, /<DawgLogo[\s\S]*src="\/logo-square\.png"/);
  assert.match(styles, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  assert.doesNotMatch(styles, /textarea, \[tabindex\]\):focus-visible/);
  assert.match(creator, /data-testid="agent-stage"[\s\S]*tabIndex=\{-1\}/);
  assert.doesNotMatch(creator, /pb-20|min-h-32|rows=\{5\}|max-w-6xl/);
  assert.match(creator, /It is not a contract deployment or proof that the runtime or providers are online\./);
  assert.match(creator, /Open Mine to view finalized owner-only earnings\./);
  assert.match(marketplace, /Verified external hires/);
  assert.match(marketplace, /getOwnerEarnings/);
  assert.match(marketplace, /Runtime proof and financial outcome remain attached to each job\./);
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
