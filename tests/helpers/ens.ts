import {
  type EnsAuthorityResolutionRequest,
  type EnsAuthorityResolver,
  type EnsAuthorityRuntime,
} from "../../src/ens/authority";

const REGISTRY = "0x1111111111111111111111111111111111111111";
const RESOLVER = "0x2222222222222222222222222222222222222222";
const RECORD_TX = `0x${"3".repeat(64)}`;

export type EnsFixtureMutator = (
  response: Record<string, unknown>,
  request: EnsAuthorityResolutionRequest,
  call: number,
) => unknown;

export class FixtureEnsAuthorityResolver implements EnsAuthorityResolver {
  readonly calls: EnsAuthorityResolutionRequest[] = [];
  private readonly now: Date;
  private mutator: EnsFixtureMutator | null;
  private beforeResolve: ((request: EnsAuthorityResolutionRequest, call: number) => Promise<void>) | null;

  constructor(options: {
    now: Date;
    mutator?: EnsFixtureMutator;
    beforeResolve?: (request: EnsAuthorityResolutionRequest, call: number) => Promise<void>;
  }) {
    this.now = options.now;
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
    const response: Record<string, unknown> = {
      schemaVersion: 1,
      observation: {
        blockNumber: String(12_345 + call),
        blockTimestamp: this.now.toISOString(),
        chainId: binding.chainId,
        transactionHash: RECORD_TX,
      },
      record: {
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
        freshUntil: new Date(this.now.getTime() + binding.maxAgeSeconds * 500).toISOString(),
      },
    };
    return this.mutator ? this.mutator(response, request, call) : response;
  }
}

export function createEnsAuthorityFixture(options: {
  now: Date;
  mutator?: EnsFixtureMutator;
  beforeResolve?: (request: EnsAuthorityResolutionRequest, call: number) => Promise<void>;
}): { resolver: FixtureEnsAuthorityResolver; runtime: EnsAuthorityRuntime } {
  const resolver = new FixtureEnsAuthorityResolver(options);
  return {
    resolver,
    runtime: {
      resolver,
      creatorName: "creator.alphadawg.eth",
      agentName: "research.creator.alphadawg.eth",
      chainId: 11_155_111,
      registry: REGISTRY,
      creatorResolver: RESOLVER,
      agentResolver: RESOLVER,
      maxAgeSeconds: 300,
      policyVersion: "ens-authority-v1",
    },
  };
}
