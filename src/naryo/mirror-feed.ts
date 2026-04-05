import { Interface } from "ethers";
import { NARYO_CONTRACT_ADDRESS } from "@/lib/links";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

/** AlphaDawgAuditLog events — must match contracts/AlphaDawgAuditLog.sol */
const AUDIT_IFACE = new Interface([
  "event CycleCompleted(address,uint256,string,string,uint256)",
  "event SpecialistHired(address,string,uint256)",
  "event DepositRecorded(address,uint256,uint256)",
  "event HeartbeatEmitted(uint256,uint256)",
  "event CrossChainCorrelation(string,string,bytes32)",
]);

export interface MirrorFeedEventRow {
  id: string;
  source: string;
  chain: string;
  eventType: string;
  txHash: string | null;
  createdAt: string;
  correlationId?: string | null;
}

function parseConsensusTimestamp(ts: string | undefined): string {
  if (!ts || typeof ts !== "string") return new Date().toISOString();
  const sec = parseFloat(ts);
  if (Number.isNaN(sec)) return new Date().toISOString();
  return new Date(sec * 1000).toISOString();
}

function eventNameFromLog(topics: string[] | undefined, data: string | undefined): string {
  if (!topics?.length) return "EVM Log";
  try {
    const parsed = AUDIT_IFACE.parseLog({
      topics: topics as [string, ...string[]],
      data: data ?? "0x",
    });
    if (parsed?.name) return parsed.name;
  } catch {
    /* fall through */
  }
  return `Log ${topics[0].slice(0, 10)}…`;
}

/**
 * Recent AlphaDawgAuditLog EVM logs from Hedera Mirror (no Naryo Docker required).
 * Used as a dashboard feed fallback when DB + buffer are empty.
 */
export async function fetchMirrorAuditLogFeed(limit = 15): Promise<MirrorFeedEventRow[]> {
  const addr =
    process.env.NARYO_AUDIT_CONTRACT_ADDRESS?.toLowerCase() ?? NARYO_CONTRACT_ADDRESS.toLowerCase();
  const url = `${MIRROR_BASE}/contracts/${addr}/results/logs?limit=${limit}&order=desc`;
  try {
    const res = await fetch(url, { next: { revalidate: 15 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { logs?: Array<Record<string, unknown>> };
    const logs = data.logs ?? [];
    return logs.map((log, idx) => {
      const topics = log.topics as string[] | undefined;
      const dataField = typeof log.data === "string" ? log.data : "0x";
      const txHash = typeof log.transaction_hash === "string" ? log.transaction_hash : null;
      const ts = log.timestamp as string | undefined;
      const name = eventNameFromLog(topics, dataField);
      return {
        id: `mirror-${txHash ?? "nohash"}-${idx}`,
        source: "mirror-evm",
        chain: "hedera",
        eventType: name,
        txHash,
        createdAt: parseConsensusTimestamp(ts),
        correlationId: null,
      };
    });
  } catch {
    return [];
  }
}
