import type { MirrorFeedEventRow } from "./mirror-feed";

/** Matches AlphaDawgAuditLog.sol + Naryo filter semantics (bounty doc table). */
const SOURCE_TO_DISPLAY: Record<string, string> = {
  hcs: "HCS audit topic message",
  hts: "HTS fund token transfer",
  cycle: "CycleCompleted",
  deposit: "DepositRecorded",
  specialist: "SpecialistHired",
  heartbeat: "HeartbeatEmitted",
  "cross-chain": "CrossChainCorrelation",
  "og-mint": "AgentMinted",
  "og-metadata": "MetadataUpdated",
  "mirror-evm": "Mirror EVM log",
};

const KNOWN_SOLIDITY_NAMES = new Set([
  "CycleCompleted",
  "SpecialistHired",
  "DepositRecorded",
  "HeartbeatEmitted",
  "CrossChainCorrelation",
  "AgentMinted",
  "MetadataUpdated",
]);

export type NaryoFeedPipeline = "buffer+db" | "db" | "mirror" | "error";

export interface NaryoFeedEventDto {
  id: string;
  source: string;
  chain: string;
  /** Raw type from Naryo payload or Mirror parser. */
  eventType: string;
  /** Human-primary label: Solidity-style name or HCS/HTS description. */
  solidityEventName: string;
  txHash: string | null;
  createdAt: string;
  correlationId?: string | null;
  /** One-line hint from decoded payload when present. */
  decodedSummary: string | null;
  /** For optional expand-in-UI (buffer uses `data`, Prisma uses `decodedData`). */
  decodedPayload: unknown | null;
}

function getDecodedPayload(row: unknown): unknown | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (r.decodedData != null) return r.decodedData;
  if (r.data != null) return r.data;
  return null;
}

function resolveSolidityName(source: string, eventType: string): string {
  if (source === "mirror-evm") {
    return eventType && eventType.length > 0 ? eventType : "AuditLog event";
  }
  if (eventType && KNOWN_SOLIDITY_NAMES.has(eventType)) {
    return eventType;
  }
  if (eventType && eventType !== "UNKNOWN" && /^[A-Z][a-zA-Z0-9]*$/.test(eventType)) {
    if (!/^(CONTRACT_EVENT|TRANSACTION)$/i.test(eventType)) {
      return eventType;
    }
  }
  return SOURCE_TO_DISPLAY[source] ?? eventType ?? "Event";
}

function decodedSummaryFromPayload(decoded: unknown): string | null {
  if (decoded == null) return null;
  if (typeof decoded === "string") {
    const t = decoded.trim();
    return t.length > 100 ? `${t.slice(0, 97)}…` : t;
  }
  if (typeof decoded === "object") {
    const o = decoded as Record<string, unknown>;
    if (typeof o.topicId === "string" && o.topicId.length > 0) {
      return `topic ${o.topicId}`;
    }
    if (typeof o.sequenceNumber === "number" && Number.isFinite(o.sequenceNumber)) {
      return `seq #${o.sequenceNumber}`;
    }
    if (typeof o.sourceChain === "string") {
      return `chain ${o.sourceChain}`;
    }
    if (typeof o.name === "string") {
      return o.name.length > 100 ? `${o.name.slice(0, 97)}…` : o.name;
    }
    try {
      const s = JSON.stringify(decoded);
      return s.length > 140 ? `${s.slice(0, 137)}…` : s;
    } catch {
      return "[object]";
    }
  }
  const s = String(decoded);
  return s.length > 100 ? `${s.slice(0, 97)}…` : s;
}

/** Normalize buffer rows, Prisma rows, or Mirror fallback rows for the dashboard. */
export function mapFeedEventRow(row: MirrorFeedEventRow | Record<string, unknown>): NaryoFeedEventDto {
  const source = typeof row.source === "string" ? row.source : "unknown";
  const chain = typeof row.chain === "string" ? row.chain : "unknown";
  const eventType = typeof row.eventType === "string" ? row.eventType : "UNKNOWN";
  const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
  const txHash = row.txHash === null || typeof row.txHash === "string" ? row.txHash : null;
  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : typeof row.createdAt === "string"
        ? row.createdAt
        : new Date().toISOString();
  const correlationId =
    row.correlationId === null || typeof row.correlationId === "string"
      ? row.correlationId
      : null;

  const decodedPayload = getDecodedPayload(row);
  const solidityEventName = resolveSolidityName(source, eventType);
  const decodedSummary = decodedSummaryFromPayload(decodedPayload);

  return {
    id,
    source,
    chain,
    eventType,
    solidityEventName,
    txHash,
    createdAt,
    correlationId,
    decodedSummary,
    decodedPayload,
  };
}

export function mapFeedEvents(
  rows: Array<MirrorFeedEventRow | Record<string, unknown>>,
): NaryoFeedEventDto[] {
  return rows.map((r) => mapFeedEventRow(r));
}
