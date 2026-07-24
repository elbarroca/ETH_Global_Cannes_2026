import {
  type EnsAuthorityResolutionRequest,
  type EnsAuthorityResolver,
  type EnsAuthorityRuntime,
} from "../../src/ens/authority";

const REGISTRY = "0x1111111111111111111111111111111111111111";
const RESOLVER = "0x2222222222222222222222222222222222222222";
const CREATOR_REGISTRY = "0x3333333333333333333333333333333333333333";
const AGENT_REGISTRY = "0x4444444444444444444444444444444444444444";
const RECORD_TX = `0x${"3".repeat(64)}`;
const CONTRACT_ROLE = `0x${"a".repeat(64)}` as `0x${string}`;
const NAME_ROLE = `0x${"b".repeat(64)}` as `0x${string}`;
const ADMIN_ROLE = `0x${"c".repeat(64)}` as `0x${string}`;
const CCIP_RESPONSE_HASH = "d".repeat(64);
const CCIP_GATEWAY = "https://ccip.fixture.invalid/alphadawg";

export type EnsFixtureMutator = (
  response: Record<string, unknown>,
  request: EnsAuthorityResolutionRequest,
  call: number,
) => unknown;

export class FixtureEnsAuthorityResolver implements EnsAuthorityResolver {
  readonly calls: EnsAuthorityResolutionRequest[] = [];
  private readonly clock: () => Date;
  private mutator: EnsFixtureMutator | null;
  private beforeResolve: ((request: EnsAuthorityResolutionRequest, call: number) => Promise<void>) | null;

  constructor(options: {
    now: Date | (() => Date);
    mutator?: EnsFixtureMutator;
    beforeResolve?: (request: EnsAuthorityResolutionRequest, call: number) => Promise<void>;
  }) {
    const suppliedNow = options.now;
    this.clock = suppliedNow instanceof Date
      ? () => new Date(suppliedNow.getTime())
      : suppliedNow;
    this.mutator = options.mutator ?? null;
    this.beforeResolve = options.beforeResolve ?? null;
  }

  setMutator(mutator: EnsFixtureMutator | null): void {
    this.mutator = mutator;
  }

  setBeforeResolve(
    beforeResolve: ((request: EnsAuthorityResolutionRequest, call: number) => Promise<void>) | null,
  ): void {
    this.beforeResolve = beforeResolve;
  }

  async resolve(request: EnsAuthorityResolutionRequest, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) throw signal.reason ?? new Error("ENS_FIXTURE_ABORTED");
    const call = this.calls.push(request);
    await this.beforeResolve?.(request, call);
    const { binding } = request;
    const now = this.clock();
    const authorityRecord: Record<string, unknown> = {
      schemaVersion: 1,
      creator: {
        name: binding.creatorName,
        node: binding.creatorNode,
        owner: binding.creatorOwner,
        delegate: binding.creatorDelegate,
        registry: binding.registry,
        resolver: binding.creatorResolver,
      },
      agent: {
        name: binding.agentName,
        node: binding.agentNode,
        owner: binding.agentOwner,
        delegate: binding.agentDelegate,
        registry: binding.registry,
        resolver: binding.agentResolver,
      },
      agentVersionId: binding.agentVersionId,
      agentVersion: binding.agentVersion,
      manifestHash: binding.manifestHash,
      capabilities: binding.capabilities,
      service: binding.service,
      chainId: binding.chainId,
      payout: binding.payout,
      policyVersion: binding.policyVersion,
      jobId: binding.jobId,
      effectId: binding.effectId,
      freshUntil: new Date(now.getTime() + binding.maxAgeSeconds * 500).toISOString(),
    };
    if (binding.ensv2) {
      Object.assign(authorityRecord, {
        schemaVersion: 2,
        creatorDnsName: binding.creatorDnsName,
        agentLabel: binding.agentLabel,
        agentDnsName: binding.agentDnsName,
        priceAtomic: binding.priceAtomic,
        rootRegistry: binding.rootRegistry,
        universalResolver: binding.universalResolver,
        ensv2: {
          creatorCanonicalRegistry: binding.ensv2.creatorCanonicalRegistry,
          agentParentRegistry: binding.ensv2.agentParentRegistry,
          agentCanonicalRegistry: binding.ensv2.agentCanonicalRegistry,
          owner: binding.agentOwner,
          delegate: binding.agentDelegate,
          roles: binding.ensv2.roles,
          externalGrants: [],
          parentExpiry: binding.ensv2.parentExpiry,
          agentExpiry: binding.ensv2.agentExpiry,
          parentLink: {
            parentName: binding.creatorName,
            childName: binding.agentName,
            forward: true,
            back: true,
          },
          alias: false,
          resolver: {
            address: binding.agentResolver,
            suffix: binding.ensv2.resolverSuffix,
            mode: binding.ensv2.resolverMode,
          },
          ccip: {
            universalResolver: binding.universalResolver,
            gateway: binding.ensv2.ccipGateway,
            status: "VERIFIED",
            responseHash: CCIP_RESPONSE_HASH,
          },
        },
      });
    }
    const response: Record<string, unknown> = {
      schemaVersion: binding.ensv2 ? 2 : 1,
      observation: {
        blockNumber: String(12_345 + call),
        blockTimestamp: now.toISOString(),
        chainId: binding.chainId,
        transactionHash: RECORD_TX,
      },
      record: authorityRecord,
    };
    return this.mutator ? this.mutator(response, request, call) : response;
  }
}

export function createEnsAuthorityFixture(options: {
  now: Date | (() => Date);
  mutator?: EnsFixtureMutator;
  beforeResolve?: (request: EnsAuthorityResolutionRequest, call: number) => Promise<void>;
  disposableTestClock?: boolean;
  resolutionTimeoutMs?: number;
  ensv2?: boolean;
  runtime?: Partial<Omit<EnsAuthorityRuntime, "resolver">>;
}): { resolver: FixtureEnsAuthorityResolver; runtime: EnsAuthorityRuntime } {
  const resolver = new FixtureEnsAuthorityResolver(options);
  const initialNow = options.now instanceof Date ? options.now : options.now();
  const expiry = new Date(initialNow.getTime() + 60 * 60 * 1_000).toISOString();
  const runtime: EnsAuthorityRuntime = {
    resolver,
    creatorName: "creator.alphadawg.eth",
    agentLabel: "research",
    agentName: "research.creator.alphadawg.eth",
    chainId: 11_155_111,
    registry: REGISTRY,
    creatorResolver: RESOLVER,
    agentResolver: RESOLVER,
    maxAgeSeconds: 300,
    policyVersion: "ens-authority-v1",
    ensv2: options.ensv2 === true
      ? {
          creatorCanonicalRegistry: CREATOR_REGISTRY,
          agentCanonicalRegistry: AGENT_REGISTRY,
          resolverMode: "EXPLICIT",
          ccipGateway: CCIP_GATEWAY,
          parentExpiry: expiry,
          agentExpiry: expiry,
          roles: [
            {
              scope: "CONTRACT",
              role: CONTRACT_ROLE,
              adminRole: ADMIN_ROLE,
              account: "OWNER",
              expiresAt: expiry,
            },
            {
              scope: "NAME",
              role: NAME_ROLE,
              adminRole: ADMIN_ROLE,
              account: "DELEGATE",
              expiresAt: expiry,
            },
          ],
        }
      : undefined,
    disposableTestClock: options.disposableTestClock ?? options.now instanceof Date,
    resolutionTimeoutMs: options.resolutionTimeoutMs,
    ...options.runtime,
  };
  return { resolver, runtime };
}
