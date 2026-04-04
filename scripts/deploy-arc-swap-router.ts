import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import { readFileSync } from "node:fs";

const RPC = process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

async function main(): Promise<void> {
  // Use ARC_DEPLOYER_PRIVATE_KEY or fall back to AGENT_MNEMONIC index 0
  let pk: string;
  if (process.env.ARC_DEPLOYER_PRIVATE_KEY) {
    const key = process.env.ARC_DEPLOYER_PRIVATE_KEY;
    pk = key.startsWith("0x") ? key : `0x${key}`;
  } else if (process.env.AGENT_MNEMONIC) {
    const wallet = ethers.HDNodeWallet.fromMnemonic(
      ethers.Mnemonic.fromPhrase(process.env.AGENT_MNEMONIC),
      "m/44'/60'/0'/0/0",
    );
    pk = wallet.privateKey;
    console.log("Using HD wallet index 0 as deployer");
  } else {
    console.error("Set ARC_DEPLOYER_PRIVATE_KEY or AGENT_MNEMONIC in .env");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(pk, provider);

  console.log("Deployer:", deployer.address);
  const balance = await provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "USDC (native)");

  if (balance === 0n) {
    console.error("ERROR: No USDC on Arc testnet. Fund from faucet first.");
    process.exit(1);
  }

  // Load compiled artifact
  const artifact = JSON.parse(
    readFileSync("./artifacts/contracts/MockSwapRouter.sol/MockSwapRouter.json", "utf-8"),
  );

  // Deploy MockSwapRouter
  console.log("\nDeploying MockSwapRouter...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const contract = await factory.deploy({ gasLimit: 3_000_000 });
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("MockSwapRouter deployed:", addr);

  // Test swap with a tiny amount (0.0001 USDC)
  console.log("\nTesting swap...");
  try {
    const testAmount = ethers.parseEther("0.0001");
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    const router = new ethers.Contract(addr, artifact.abi, deployer);
    const tx = await router.exactInputSingle(
      {
        tokenIn: "0x3600000000000000000000000000000000000000",
        tokenOut: "0x0000000000000000000000000000000000000001",
        fee: 3000,
        recipient: deployer.address,
        deadline,
        amountIn: testAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      },
      { value: testAmount, gasLimit: 200_000 },
    );
    const receipt = await tx.wait();
    console.log("Test swap tx:", receipt.hash);
    console.log("Test swap status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
  } catch (err) {
    console.warn("Test swap failed (non-fatal):", err instanceof Error ? err.message : String(err));
  }

  // Print .env values
  console.log("\n════════════════════════════════════════");
  console.log("Add to .env:");
  console.log(`ARC_UNISWAP_ROUTER=${addr}`);
  console.log("════════════════════════════════════════");
  console.log(`\nExplorer: https://testnet.arcscan.app/address/${addr}`);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
