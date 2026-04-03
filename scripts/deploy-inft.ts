import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { readFileSync } from "node:fs";

const RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

async function main(): Promise<void> {
  const key = process.env.OG_PRIVATE_KEY!;
  const pk = key.startsWith("0x") ? key : `0x${key}`;
  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Deployer:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "A0GI");

  if (balance === 0n) {
    console.error("ERROR: No A0GI tokens. Get them from https://hub.0g.ai");
    process.exit(1);
  }

  // Load compiled artifacts
  const oracleArtifact = JSON.parse(
    readFileSync("./artifacts/contracts/MockOracle.sol/MockOracle.json", "utf-8"),
  );
  const agentArtifact = JSON.parse(
    readFileSync("./artifacts/contracts/VaultMindAgent.sol/VaultMindAgent.json", "utf-8"),
  );

  // 1. Deploy MockOracle
  console.log("\n1. Deploying MockOracle...");
  const oracleFactory = new ethers.ContractFactory(oracleArtifact.abi, oracleArtifact.bytecode, deployer);
  const oracle = await oracleFactory.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log("   MockOracle:", oracleAddr);

  // 2. Deploy VaultMindAgent with oracle address
  console.log("\n2. Deploying VaultMindAgent...");
  const agentFactory = new ethers.ContractFactory(agentArtifact.abi, agentArtifact.bytecode, deployer);
  const agent = await agentFactory.deploy(oracleAddr);
  await agent.waitForDeployment();
  const agentAddr = await agent.getAddress();
  console.log("   VaultMindAgent:", agentAddr);

  // 3. Verify oracle is set
  const storedOracle = await (agent as ethers.Contract).getFunction("getOracle")();
  console.log("   Oracle stored:", storedOracle === oracleAddr ? "OK" : "MISMATCH");

  // 4. Print .env values
  console.log("\n════════════════════════════════════════");
  console.log("Add to .env:");
  console.log(`MOCK_ORACLE_ADDRESS=${oracleAddr}`);
  console.log(`INFT_CONTRACT_ADDRESS=${agentAddr}`);
  console.log("════════════════════════════════════════");
  console.log(`\nExplorer: https://chainscan-newton.0g.ai/address/${agentAddr}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
