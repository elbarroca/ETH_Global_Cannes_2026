import type { Address, PublicClient } from "viem";
import {
  EnsAuthorityResolverError,
  type EnsAuthorityResolver,
  type EnsAuthorityResolutionRequest,
} from "./authority";

const registryAbi = [{
  type: "function",
  name: "owner",
  stateMutability: "view",
  inputs: [{ name: "node", type: "bytes32" }],
  outputs: [{ name: "", type: "address" }],
}] as const;

async function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason ?? new Error("ENS_AUTHORITY_ABORTED");
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(signal.reason ?? new Error("ENS_AUTHORITY_ABORTED"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then((value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
  });
}

function requiredText(value: string | null): string {
  if (value === null) throw new Error("missing ENS text record");
  return value;
}

export function createViemEnsAuthorityResolver(
  client: PublicClient,
  universalResolverAddress: Address,
): EnsAuthorityResolver {
  return {
    async resolve(request: EnsAuthorityResolutionRequest, signal: AbortSignal): Promise<unknown> {
      try {
        const { binding } = request;
        const chainId = await abortable(client.getChainId(), signal);
        const blockNumber = await abortable(client.getBlockNumber(), signal);
        const block = await abortable(client.getBlock({ blockNumber }), signal);
        const ensParameters = { blockNumber, strict: true, universalResolverAddress } as const;
        const text = (key: string): Promise<string | null> => client.getEnsText({
          ...ensParameters,
          key,
          name: binding.agentName,
        });
        const [
          creatorOwner,
          agentOwner,
          creatorResolver,
          agentResolver,
          creatorDelegate,
          agentDelegate,
          agentVersionId,
          agentVersion,
          manifestHash,
          capabilities,
          service,
          recordChainId,
          payout,
          policyVersion,
          jobId,
          effectId,
          freshUntil,
          transactionHash,
        ] = await abortable(Promise.all([
          client.readContract({
            abi: registryAbi,
            address: binding.registry as Address,
            args: [binding.creatorNode],
            blockNumber,
            functionName: "owner",
          }),
          client.readContract({
            abi: registryAbi,
            address: binding.registry as Address,
            args: [binding.agentNode],
            blockNumber,
            functionName: "owner",
          }),
          client.getEnsResolver({
            blockNumber,
            name: binding.creatorName,
            universalResolverAddress,
          }),
          client.getEnsResolver({
            blockNumber,
            name: binding.agentName,
            universalResolverAddress,
          }),
          client.getEnsAddress({ ...ensParameters, name: binding.creatorName }),
          client.getEnsAddress({ ...ensParameters, name: binding.agentName }),
          text("alphadawg.agent-id"),
          text("alphadawg.version"),
          text("alphadawg.manifest"),
          text("alphadawg.capability"),
          text("alphadawg.service"),
          text("alphadawg.chain"),
          text("alphadawg.payout"),
          text("alphadawg.policy"),
          text("alphadawg.job"),
          text("alphadawg.effect"),
          text("alphadawg.fresh-until"),
          text("alphadawg.record-tx"),
        ]), signal);
        const parsedCapabilities: unknown = JSON.parse(requiredText(capabilities));
        const parsedVersion = Number(requiredText(agentVersion));
        const parsedRecordChainId = Number(requiredText(recordChainId));
        return {
          schemaVersion: 1,
          observation: {
            blockNumber: blockNumber.toString(),
            blockTimestamp: new Date(Number(block.timestamp) * 1_000).toISOString(),
            chainId,
            transactionHash,
          },
          record: {
            schemaVersion: 1,
            creator: {
              name: binding.creatorName,
              node: binding.creatorNode,
              owner: creatorOwner,
              delegate: creatorDelegate,
              registry: binding.registry,
              resolver: creatorResolver,
            },
            agent: {
              name: binding.agentName,
              node: binding.agentNode,
              owner: agentOwner,
              delegate: agentDelegate,
              registry: binding.registry,
              resolver: agentResolver,
            },
            agentVersionId: requiredText(agentVersionId),
            agentVersion: parsedVersion,
            manifestHash: requiredText(manifestHash),
            capabilities: parsedCapabilities,
            service: requiredText(service),
            chainId: parsedRecordChainId,
            payout: requiredText(payout),
            policyVersion: requiredText(policyVersion),
            jobId: requiredText(jobId),
            effectId: requiredText(effectId),
            freshUntil: requiredText(freshUntil),
          },
        };
      } catch (error) {
        if (signal.aborted) throw signal.reason ?? error;
        throw new EnsAuthorityResolverError("ENS_AUTHORITY_RESOLVER_OUTAGE");
      }
    },
  };
}
