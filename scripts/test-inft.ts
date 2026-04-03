import dotenv from "dotenv";
dotenv.config();

import { ethers, keccak256, toUtf8Bytes } from "ethers";

const ABI = [
  "function mintAgent(address to, address agentWallet, string encryptedURI, bytes32 metadataHash, bytes32 soulHash, string riskProfile) returns (uint256)",
  "function updateMetadata(uint256 tokenId, bytes32 newMetadataHash, string newURI)",
  "function updateRiskProfile(uint256 tokenId, string newProfile)",
  "function getAgent(uint256 tokenId) view returns (address owner, address wallet, bytes32 metaHash, string uri, bytes32 soul, string risk, uint256 cycles)",
  "function getAgentByWallet(address wallet) view returns (uint256)",
  "function intelligentDataOf(uint256 tokenId) view returns (tuple(string dataDescription, bytes32 dataHash)[])",
  "function cycleCount(uint256) view returns (uint256)",
  "function getOracle() view returns (address)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, address agentWallet, bytes32 soulHash)",
];

const RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const key = process.env.OG_PRIVATE_KEY!;
const pk = key.startsWith("0x") ? key : `0x${key}`;

const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(pk, provider);
const contract = new ethers.Contract(process.env.INFT_CONTRACT_ADDRESS!, ABI, signer);

let passed = 0;
let failed = 0;

function ok(name: string, detail?: string): void {
  passed++;
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string): void {
  failed++;
  console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
}

// Generate unique test addresses for this run
const testUser = ethers.Wallet.createRandom();
const testProxy = ethers.Wallet.createRandom();

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log("  iNFT E2E TEST — VaultMindAgent on 0G Chain");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Contract: ${process.env.INFT_CONTRACT_ADDRESS}`);
  console.log(`  Test user: ${testUser.address}`);
  console.log(`  Test proxy: ${testProxy.address}\n`);

  // TEST 1: Oracle is set
  console.log("TEST 1: Contract state");
  const oracleAddr = await contract.getOracle();
  if (oracleAddr === process.env.MOCK_ORACLE_ADDRESS) {
    ok("Oracle address matches .env");
  } else {
    fail("Oracle address", `got ${oracleAddr}`);
  }

  // TEST 2: Mint an agent iNFT
  console.log("\nTEST 2: Mint agent");
  const soulHash = keccak256(toUtf8Bytes("VaultMind Test Agent SOUL"));
  const metaHash = keccak256(toUtf8Bytes("genesis"));

  const mintTx = await contract.mintAgent(
    testUser.address,
    testProxy.address,
    "0g-storage://genesis",
    metaHash,
    soulHash,
    "balanced",
  );
  const mintReceipt = await mintTx.wait();
  if (mintReceipt.status === 1) ok("Mint transaction succeeded");
  else fail("Mint transaction");

  // Parse tokenId from event
  let tokenId = 0;
  for (const log of mintReceipt.logs) {
    try {
      const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgentMinted") {
        tokenId = Number(parsed.args[0]);
      }
    } catch { /* skip */ }
  }
  if (tokenId > 0) ok(`Token minted with ID ${tokenId}`);
  else fail("Token ID parsing");
  console.log(`  → tx: ${mintReceipt.hash}`);

  // TEST 3: Read agent back
  console.log("\nTEST 3: Read agent data");
  const info = await contract.getAgent(tokenId);
  info[0].toLowerCase() === testUser.address.toLowerCase()
    ? ok("Owner matches test user") : fail("Owner mismatch");
  info[1].toLowerCase() === testProxy.address.toLowerCase()
    ? ok("Agent wallet matches proxy") : fail("Wallet mismatch");
  info[2] === metaHash ? ok("Metadata hash matches") : fail("Meta hash mismatch");
  info[3] === "0g-storage://genesis" ? ok("Encrypted URI is genesis") : fail("URI mismatch");
  info[4] === soulHash ? ok("Soul hash matches") : fail("Soul hash mismatch");
  info[5] === "balanced" ? ok("Risk profile is balanced") : fail("Risk mismatch");
  Number(info[6]) === 0 ? ok("Cycle count starts at 0") : fail("Cycle count mismatch");

  // TEST 4: Reverse lookup
  console.log("\nTEST 4: Reverse lookup");
  const lookupId = await contract.getAgentByWallet(testProxy.address);
  Number(lookupId) === tokenId
    ? ok(`walletToToken(proxy) = ${tokenId}`) : fail("Reverse lookup mismatch");

  // TEST 5: intelligentDataOf (ERC-7857)
  console.log("\nTEST 5: IntelligentData (ERC-7857)");
  const intData = await contract.intelligentDataOf(tokenId);
  intData.length === 2 ? ok("Returns 2 IntelligentData entries") : fail("Wrong entry count");
  intData[0].dataDescription === "agent_memory" ? ok("First = agent_memory") : fail("First desc wrong");
  intData[0].dataHash === metaHash ? ok("Memory hash matches metadata") : fail("Memory hash mismatch");
  intData[1].dataDescription === "agent_soul" ? ok("Second = agent_soul") : fail("Second desc wrong");
  intData[1].dataHash === soulHash ? ok("Soul hash matches") : fail("Soul hash mismatch");

  // TEST 6: Update metadata (3 cycles)
  console.log("\nTEST 6: Metadata updates (3 cycles)");
  for (let i = 1; i <= 3; i++) {
    const fakeRoot = `0g_storage_root_hash_cycle_${i}`;
    const newHash = keccak256(toUtf8Bytes(fakeRoot));
    const newURI = `0g-storage://${fakeRoot}`;
    const tx = await contract.updateMetadata(tokenId, newHash, newURI);
    const receipt = await tx.wait();
    receipt.status === 1 ? ok(`Cycle ${i} update tx succeeded`) : fail(`Cycle ${i} update`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const cyclesAfter = await contract.cycleCount(tokenId);
  Number(cyclesAfter) === 3 ? ok(`Cycle count = 3`) : fail(`Cycle count = ${cyclesAfter}`);

  const updatedInfo = await contract.getAgent(tokenId);
  (updatedInfo[3] as string).startsWith("0g-storage://0g_storage_root")
    ? ok("URI points to latest cycle") : fail("URI not updated");

  // TEST 7: Update risk profile
  console.log("\nTEST 7: Risk profile change");
  const riskTx = await contract.updateRiskProfile(tokenId, "aggressive");
  const riskReceipt = await riskTx.wait();
  riskReceipt.status === 1 ? ok("Risk update tx succeeded") : fail("Risk update tx");
  const riskInfo = await contract.getAgent(tokenId);
  riskInfo[5] === "aggressive" ? ok("Risk changed to aggressive") : fail("Risk not updated");

  // TEST 8: Duplicate wallet rejection
  console.log("\nTEST 8: Duplicate wallet guard");
  try {
    await contract.mintAgent(testUser.address, testProxy.address, "dup", metaHash, soulHash, "conservative");
    fail("Duplicate wallet was NOT rejected");
  } catch {
    ok("Duplicate proxy wallet correctly rejected");
  }

  // TEST 9: Nonexistent token rejection
  console.log("\nTEST 9: Invalid token guard");
  try {
    await contract.getAgent(9999);
    fail("Nonexistent token was NOT rejected");
  } catch {
    ok("Nonexistent token correctly reverts");
  }

  // Results
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  RESULTS: ✅ ${passed} passed · ❌ ${failed} failed`);
  console.log("═══════════════════════════════════════════════");

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log(`\n  Token ID: ${tokenId}`);
    console.log(`  Contract: ${process.env.INFT_CONTRACT_ADDRESS}`);
    console.log(`  Explorer: https://chainscan-newton.0g.ai/address/${process.env.INFT_CONTRACT_ADDRESS}\n`);
  }
}

main().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
