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
  "arc-swap": "Swap",
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
  "Swap",
]);

/** Inner multichain listener payload — only these two `eventType` values in `decodedData`. */
export type NaryoPayloadKind = "CONTRACT" | "TRANSACTION";

export type NaryoFeedPipeline = "buffer+db" | "db" | "mirror" | "error";

export interface NaryoFeedEventDto {
  id: string;
  source: string;
  chain: string;
  /** Raw type from Naryo payload or Mirror parser. */
  eventType: string;
  /** When the decoded payload uses CONTRACT / TRANSACTION semantics. */
  payloadKind: NaryoPayloadKind | null;
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

/** Naryo filter key → canonical chain id for the dashboard (when DB chain is missing). */
const SOURCE_TO_CHAIN: Record<string, string> = {
  hcs: "hedera",
  hts: "hedera",
  cycle: "hedera",
  deposit: "hedera",
  specialist: "hedera",
  heartbeat: "hedera",
  "cross-chain": "hedera",
  "og-mint": "0g-chain",
  "og-metadata": "0g-chain",
  "arc-swap": "arc",
  "mirror-evm": "hedera",
};

function getDecodedPayload(row: unknown): unknown | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (r.decodedData != null) return r.decodedData;
  if (r.decoded_data != null) return r.decoded_data;
  if (r.data != null) return r.data;
  const raw = r.rawPayload ?? r.raw_payload;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rp = raw as Record<string, unknown>;
    if (rp.details != null) return rp.details;
    if (typeof rp.eventType === "string") return rp;
  }
  return null;
}

function resolveRowSource(row: Record<string, unknown>): string {
  const s = row.source;
  if (typeof s === "string" && s.length > 0) return s;
  const raw = row.rawPayload ?? row.raw_payload;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const src = (raw as Record<string, unknown>).source;
    if (typeof src === "string" && src.length > 0) return src;
  }
  return "unknown";
}

function resolveDisplayChain(source: string, chain: string): string {
  const c = chain && chain !== "unknown" ? chain : "";
  if (c) return c;
  return SOURCE_TO_CHAIN[source] ?? "unknown";
}

/** Event / contract name when `eventType` casing or shape varies. */
function extractPayloadEventName(decoded: unknown | null): string | null {
  if (decoded == null || typeof decoded !== "object" || Array.isArray(decoded)) return null;
  const o = decoded as Record<string, unknown>;
  const n = o.name;
  if (typeof n === "string" && n.trim()) return n.trim();
  if (n && typeof n === "object" && n !== null && "value" in n) {
    const v = (n as { value: unknown }).value;
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Multichain Naryo `details` JSON uses `eventType`: "CONTRACT" | "TRANSACTION" only.
 * Derive a human title (event name for contracts, "Transaction" for txs).
 */
function titleFromMultichainPayload(decoded: unknown | null, source: string): string | null {
  if (decoded == null || typeof decoded !== "object" || Array.isArray(decoded)) return null;
  const o = decoded as Record<string, unknown>;
  const kind = o.eventType;
  const kindStr = typeof kind === "string" ? kind.toUpperCase() : "";
  if (kindStr === "TRANSACTION") return "Transaction";
  if (kindStr !== "CONTRACT") return null;
  const fromName = extractPayloadEventName(decoded);
  if (fromName) return fromName;
  return SOURCE_TO_DISPLAY[source] ?? "Contract event";
}

function resolvePayloadKind(decoded: unknown | null, rowEventType: string): NaryoPayloadKind | null {
  if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
    const et = (decoded as Record<string, unknown>).eventType;
    if (typeof et === "string") {
      const u = et.toUpperCase();
      if (u === "CONTRACT") return "CONTRACT";
      if (u === "TRANSACTION") return "TRANSACTION";
    }
  }
  if (rowEventType === "CONTRACT_EVENT") return "CONTRACT";
  if (rowEventType === "TRANSACTION") return "TRANSACTION";
  return null;
}

function resolveSolidityName(source: string, eventType: string, decoded: unknown | null): string {
  const fromPayload = titleFromMultichainPayload(decoded, source);
  if (fromPayload) return fromPayload;

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
  const mapped = SOURCE_TO_DISPLAY[source];
  if (mapped) return mapped;
  if (eventType === "CONTRACT_EVENT") return "Contract event";
  if (eventType === "TRANSACTION") return "Transaction";
  const nameOnly = extractPayloadEventName(decoded);
  if (nameOnly) return nameOnly;
  if (eventType && eventType !== "UNKNOWN") return eventType;
  return "Event";
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
  const r = row as Record<string, unknown>;
  const source = resolveRowSource(r);
  const rawChain = typeof r.chain === "string" ? r.chain : "unknown";
  const chain = resolveDisplayChain(source, rawChain);
  const eventType = typeof r.eventType === "string" ? r.eventType : "UNKNOWN";
  const id = typeof r.id === "string" ? r.id : String(r.id ?? "");
  const txHash =
    r.txHash === null || typeof r.txHash === "string"
      ? r.txHash
      : r.tx_hash === null || typeof r.tx_hash === "string"
        ? r.tx_hash
        : null;
  const createdAt =
    r.createdAt instanceof Date
      ? r.createdAt.toISOString()
      : typeof r.createdAt === "string"
        ? r.createdAt
        : typeof r.created_at === "string"
          ? r.created_at
          : new Date().toISOString();
  const correlationId =
    r.correlationId === null || typeof r.correlationId === "string"
      ? r.correlationId
      : r.correlation_id === null || typeof r.correlation_id === "string"
        ? r.correlation_id
        : null;

  const decodedPayload = getDecodedPayload(row);
  const payloadKind = resolvePayloadKind(decodedPayload, eventType);
  const solidityEventName = resolveSolidityName(source, eventType, decodedPayload);
  const decodedSummary = decodedSummaryFromPayload(decodedPayload);

  return {
    id,
    source,
    chain,
    eventType,
    payloadKind,
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
