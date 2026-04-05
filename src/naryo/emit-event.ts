import { ethers } from "ethers";

// Minimal ABI — only emit functions
const ABI = [
  "function emitCycleCompleted(address user, uint256 cycleId, string action, string asset, uint256 pct)",
  "function emitSpecialistHired(address user, string specialistName, uint256 costMicroUsd)",
  "function emitDepositRecorded(address user, uint256 amountUsd, uint256 newNavUsd)",
  "function emitHeartbeat(uint256 activeUsers)",
  "function emitCrossChainCorrelation(string sourceChain, string eventType, bytes32 sourceTxHash)",
];

const GAS_LIMIT = 150_000;

function getContractAddress(): string {
  const addr = process.env.NARYO_AUDIT_CONTRACT_ADDRESS;
  if (!addr) throw new Error("NARYO_AUDIT_CONTRACT_ADDRESS not set in .env");
  return addr;
}

function getRpcUrl(): string {
  return process.env.HEDERA_JSON_RPC_URL ?? "https://testnet.hashio.io/api";
}

let _contract: ethers.Contract | null = null;

/** Serialize Hedera EVM writes so nonce never races under burst emits. */
let _emitQueue: Promise<unknown> = Promise.resolve();

function enqueueEmit<T>(fn: () => Promise<T>): Promise<T> {
  const next = _emitQueue.then(() => fn());
  _emitQueue = next.then(() => undefined).catch(() => undefined);
  return next;
}

function getContract(): ethers.Contract {
  if (_contract) return _contract;
  const key = process.env.HEDERA_EVM_PRIVATE_KEY;
  if (!key) throw new Error("HEDERA_EVM_PRIVATE_KEY not set in .env");
  const pk = key.startsWith("0x") ? key : `0x${key}`;
  const provider = new ethers.JsonRpcProvider(getRpcUrl());
  const wallet = new ethers.Wallet(pk, provider);
  _contract = new ethers.Contract(getContractAddress(), ABI, wallet);
  return _contract;
}

/**
 * Emit CycleCompleted event on Hedera EVM.
 * Non-fatal — returns txHash on success, null on failure.
 */
export async function emitCycleEvent(
  userAddress: string,
  cycleId: number,
  action: string,
  asset: string,
  pct: number,
): Promise<string | null> {
  return enqueueEmit(async () => {
    try {
      const contract = getContract();
      const tx = await contract.emitCycleCompleted(
        userAddress, cycleId, action, asset, pct,
        { gasLimit: GAS_LIMIT },
      );
      await tx.wait();
      console.log(`[naryo] CycleCompleted event emitted: cycle=${cycleId} action=${action} tx=${tx.hash}`);
      return tx.hash as string;
    } catch (err) {
      console.warn("[naryo] emitCycleEvent failed (non-fatal):", err instanceof Error ? err.message : String(err));
      return null;
    }
  });
}

/**
 * Emit SpecialistHired event on Hedera EVM.
 * Non-fatal.
 */
export async function emitSpecialistEvent(
  userAddress: string,
  specialistName: string,
  costMicroUsd: number,
): Promise<string | null> {
  return enqueueEmit(async () => {
    try {
      const contract = getContract();
      const tx = await contract.emitSpecialistHired(
        userAddress, specialistName, costMicroUsd,
        { gasLimit: GAS_LIMIT },
      );
      await tx.wait();
      console.log(`[naryo] SpecialistHired event emitted: ${specialistName} tx=${tx.hash}`);
      return tx.hash as string;
    } catch (err) {
      console.warn("[naryo] emitSpecialistEvent failed (non-fatal):", err instanceof Error ? err.message : String(err));
      return null;
    }
  });
}

/**
 * Emit DepositRecorded event on Hedera EVM.
 * Non-fatal.
 */
export async function emitDepositEvent(
  userAddress: string,
  amountUsd: number,
  newNavUsd: number,
): Promise<string | null> {
  return enqueueEmit(async () => {
    try {
      const contract = getContract();
      const amountWei = Math.round(amountUsd * 1e6); // micro-USD
      const navWei = Math.round(newNavUsd * 1e6);
      const tx = await contract.emitDepositRecorded(
        userAddress, amountWei, navWei,
        { gasLimit: GAS_LIMIT },
      );
      await tx.wait();
      console.log(`[naryo] DepositRecorded event emitted: $${amountUsd} tx=${tx.hash}`);
      return tx.hash as string;
    } catch (err) {
      console.warn("[naryo] emitDepositEvent failed (non-fatal):", err instanceof Error ? err.message : String(err));
      return null;
    }
  });
}

/**
 * Emit HeartbeatEmitted event on Hedera EVM.
 * Non-fatal.
 */
export async function emitHeartbeatEvent(activeUsers: number): Promise<string | null> {
  return enqueueEmit(async () => {
    try {
      const contract = getContract();
      const tx = await contract.emitHeartbeat(activeUsers, { gasLimit: GAS_LIMIT });
      await tx.wait();
      return tx.hash as string;
    } catch (err) {
      console.warn("[naryo] emitHeartbeatEvent failed (non-fatal):", err instanceof Error ? err.message : String(err));
      return null;
    }
  });
}

/**
 * Emit CrossChainCorrelation event on Hedera EVM.
 * Called when Naryo detects an event on another chain (0G) and we want
 * to prove the correlation on Hedera.
 * Non-fatal.
 */
export async function emitCrossChainEvent(
  sourceChain: string,
  eventType: string,
  sourceTxHash: string,
): Promise<string | null> {
  return enqueueEmit(async () => {
    try {
      const contract = getContract();
      // Pad/truncate tx hash to bytes32
      const hashBytes = ethers.zeroPadValue(
        ethers.getBytes(sourceTxHash.length >= 66 ? sourceTxHash : ethers.id(sourceTxHash)),
        32,
      );
      const tx = await contract.emitCrossChainCorrelation(
        sourceChain, eventType, hashBytes,
        { gasLimit: GAS_LIMIT },
      );
      await tx.wait();
      console.log(`[naryo] CrossChainCorrelation: ${sourceChain}/${eventType} tx=${tx.hash}`);
      return tx.hash as string;
    } catch (err) {
      console.warn("[naryo] emitCrossChainEvent failed (non-fatal):", err instanceof Error ? err.message : String(err));
      return null;
    }
  });
}
