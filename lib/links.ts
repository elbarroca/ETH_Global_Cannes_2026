// Centralized URL builders for all on-chain explorers used by AlphaDawg.
//
// This module is the single source of truth for:
//   · 0G Chain (Galileo testnet, chainId 16602) — iNFT contract, VM contracts
//   · Hedera testnet — HCS audit topic, HTS fund token
//   · Arc testnet (chainId 5042002) — USDC payments, swap router
//
// Historical note: an earlier version of this file pointed at
// `chainscan-newton.0g.ai` — that domain is dead (ECONNREFUSED). 0G rebranded
// its testnet from Newton → Galileo, and the current explorer is
// `chainscan-galileo.0g.ai`. Every link below reflects that.
//
// 0G Storage has NO public browser explorer for Merkle root hashes. Storage
// roots are retrievable only via the 0G indexer API (programmatic). Callers
// should render storage hashes as copyable text, not as a clickable link —
// `ogStorageUrl()` always returns `null` by design.

// ── Live on-chain assets (verified in progress/ON-CHAIN-FIX-STATUS.md §2) ────

/** VaultMindAgent ERC-7857 iNFT contract on 0G Chain. */
export const INFT_CONTRACT_ADDRESS = "0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874";

/** MockOracle used by the iNFT contract for TEE/ZKP attestations. */
export const MOCK_ORACLE_ADDRESS = "0x4E8B9a9331CD35E43405a503E34b1fff945a580e";

/** MockSwapRouter on Arc testnet — handles all agent trade execution. */
export const ARC_SWAP_ROUTER_ADDRESS = "0xaac18860AfDcBDd8Cd6D4De8f603a09607D64C96";

/** Hedera HCS topic storing immutable per-cycle audit records. */
export const HCS_TOPIC_ID = "0.0.8497439";

/** Hedera HTS token backing the AlphaDawg fund (VMF share token). */
export const HTS_FUND_TOKEN_ID = "0.0.8498202";

/** Naryo multichain event audit contract on Hedera EVM. */
export const NARYO_CONTRACT_ADDRESS = "0x66D2b95e6228E7639f9326C5573466579dd7e139";

// ── Explorer base URLs ──────────────────────────────────────────────────────

/**
 * 0G Chain Galileo testnet explorer. The old `chainscan-newton.0g.ai` domain
 * is dead. Allow an env override for future renames.
 */
const OG_EXPLORER_BASE =
  process.env.NEXT_PUBLIC_OG_EXPLORER_URL ?? "https://chainscan-galileo.0g.ai";

const HASHSCAN_BASE = "https://hashscan.io/testnet";
const ARCSCAN_BASE = "https://testnet.arcscan.app";

// ── 0G Chain (Galileo) ──────────────────────────────────────────────────────

export function ogChainTxUrl(txHash: string): string | null {
  if (!txHash || !txHash.startsWith("0x")) return null;
  return `${OG_EXPLORER_BASE}/tx/${txHash}`;
}

export function ogChainAddressUrl(address: string): string {
  return `${OG_EXPLORER_BASE}/address/${address}`;
}

/**
 * Link to the contract token tab. Use this for the iNFT collection landing
 * page (all minted tokens listed).
 */
export function ogChainTokenContractUrl(contract: string): string {
  return `${OG_EXPLORER_BASE}/token/${contract}`;
}

/**
 * Link to a specific NFT by `contract` + `tokenId`. Uses the Etherscan
 * `?a={tokenId}` query param convention that most fork explorers support.
 * If the explorer doesn't resolve the token ID, it falls back gracefully
 * to the contract's token landing page.
 */
export function ogChainNftUrl(contract: string, tokenId: number | string): string {
  return `${OG_EXPLORER_BASE}/token/${contract}?a=${tokenId}`;
}

/** Convenience: link to a specific iNFT under the live VaultMindAgent contract. */
export function inftTokenUrl(tokenId: number | string): string {
  return ogChainNftUrl(INFT_CONTRACT_ADDRESS, tokenId);
}

/**
 * 0G Storage root hashes have no public browser explorer — they're only
 * retrievable via the 0G indexer API programmatically. Always returns null
 * so callers know to render a copyable display instead of a broken link.
 *
 * @deprecated — name kept for backwards compat; will be removed once all
 *   callers switch to the copyable display pattern.
 */
export function ogStorageUrl(_rootHash: string): string | null {
  return null;
}

// ── Hedera (Hashscan testnet) ───────────────────────────────────────────────

export function hashscanTopicUrl(topicId: string): string {
  return `${HASHSCAN_BASE}/topic/${topicId}`;
}

export function hashscanMessageUrl(topicId: string, seqNum: number | string): string {
  return `${HASHSCAN_BASE}/topic/${topicId}?s=${seqNum}`;
}

export function hashscanTxUrl(txHash: string): string | null {
  if (!txHash) return null;
  return `${HASHSCAN_BASE}/transaction/${txHash}`;
}

export function hashscanTokenUrl(tokenId: string): string {
  return `${HASHSCAN_BASE}/token/${tokenId}`;
}

export function hashscanAccountUrl(accountId: string): string {
  return `${HASHSCAN_BASE}/account/${accountId}`;
}

export function hashscanContractUrl(contractAddress: string): string {
  return `${HASHSCAN_BASE}/contract/${contractAddress}`;
}

// ── Arc testnet (ArcScan) ───────────────────────────────────────────────────

export function arcTxUrl(txHash: string): string | null {
  if (!txHash || !txHash.startsWith("0x")) return null;
  return `${ARCSCAN_BASE}/tx/${txHash}`;
}

/**
 * Docs for GET a Developer Wallets transaction by id (Bearer auth). Circle does
 * not host a public “open in browser” URL per tx id — paths like
 * `developers.circle.com/.../transactions/{uuid}` return 404.
 *
 * @see https://developers.circle.com/api-reference/wallets/developer-controlled-wallets/get-transaction
 */
export const CIRCLE_WALLET_GET_TX_DOC_URL =
  "https://developers.circle.com/api-reference/wallets/developer-controlled-wallets/get-transaction";

/** No public explorer URL per Circle wallet tx id — use copyable id + {@link CIRCLE_WALLET_GET_TX_DOC_URL}. */
export function circleWalletTxUrl(_txId: string): string | null {
  return null;
}

/** Circle Gateway gas-free x402 nanopayments (agentic / overview). */
export const CIRCLE_GATEWAY_NANOPAYMENTS_DOC_URL =
  "https://developers.circle.com/gateway/nanopayments";

/** How Gateway batches authorizations into on-chain settlement. */
export const CIRCLE_GATEWAY_BATCHED_SETTLEMENT_DOC_URL =
  "https://developers.circle.com/gateway/nanopayments/concepts/batched-settlement";

export function arcAddressUrl(address: string): string {
  return `${ARCSCAN_BASE}/address/${address}`;
}

// ── Unified "live contracts" table ──────────────────────────────────────────
// The four smart contracts / chain-level assets that judges need to verify in
// one click. Consumed by the `<LiveContractsMenu>` dropdown in SwarmStatusBar.

export interface LiveContract {
  /** Short label — e.g. "iNFT Contract". */
  label: string;
  /** Short chain tag — e.g. "0G Chain", "Hedera", "Arc". */
  chain: "0G Chain" | "Hedera" | "Arc";
  /** One-line description of what judges will find at this link. */
  description: string;
  /** Direct explorer URL. */
  href: string;
  /** Raw identifier for display (contract address or topic ID). */
  identifier: string;
}

export const LIVE_CONTRACTS: readonly LiveContract[] = [
  {
    label: "VaultMindAgent iNFT",
    chain: "0G Chain",
    description: "ERC-7857 intelligent NFT — each user's agent identity is minted here",
    href: ogChainAddressUrl(INFT_CONTRACT_ADDRESS),
    identifier: INFT_CONTRACT_ADDRESS,
  },
  {
    label: "HCS Audit Topic",
    chain: "Hedera",
    description: "Immutable per-cycle audit trail — every decision logged as a topic message",
    href: hashscanTopicUrl(HCS_TOPIC_ID),
    identifier: HCS_TOPIC_ID,
  },
  {
    label: "HTS Fund Token",
    chain: "Hedera",
    description: "VMF share token for fractional fund exposure",
    href: hashscanTokenUrl(HTS_FUND_TOKEN_ID),
    identifier: HTS_FUND_TOKEN_ID,
  },
  {
    label: "Arc Swap Router",
    chain: "Arc",
    description: "MockSwapRouter handling every real trade tx on Arc testnet",
    href: arcAddressUrl(ARC_SWAP_ROUTER_ADDRESS),
    identifier: ARC_SWAP_ROUTER_ADDRESS,
  },
] as const;

// ── Display helpers ─────────────────────────────────────────────────────────

/** Compact `0x1234…abcd` representation for any hash or address. */
export function truncateHash(hash: string, head = 8, tail = 4): string {
  if (!hash) return "—";
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
