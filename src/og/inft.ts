import { ethers, keccak256, toUtf8Bytes } from "ethers";
import { readFileSync } from "node:fs";

// Minimal ABI — only functions we call
const ABI = [
  // Write
  "function mintAgent(address to, address agentWallet, string encryptedURI, bytes32 metadataHash, bytes32 soulHash, string riskProfile) returns (uint256)",
  "function updateMetadata(uint256 tokenId, bytes32 newMetadataHash, string newURI)",
  "function updateRiskProfile(uint256 tokenId, string newProfile)",

  // Read
  "function getAgent(uint256 tokenId) view returns (address owner, address wallet, bytes32 metaHash, string uri, bytes32 soul, string risk, uint256 cycles)",
  "function getAgentByWallet(address wallet) view returns (uint256)",
  "function intelligentDataOf(uint256 tokenId) view returns (tuple(string dataDescription, bytes32 dataHash)[])",
  "function walletToToken(address) view returns (uint256)",
  "function cycleCount(uint256) view returns (uint256)",
  "function getOracle() view returns (address)",

  // Events
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, address agentWallet, bytes32 soulHash)",
  "event MetadataUpdated(uint256 indexed tokenId, bytes32 newMetadataHash, string newURI, uint256 newCycleCount)",
];

function getContractAddress(): string {
  const addr = process.env.INFT_CONTRACT_ADDRESS;
  if (!addr) throw new Error("INFT_CONTRACT_ADDRESS not set in .env");
  return addr;
}

function getRpcUrl(): string {
  return process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
}

// 0G Chain (16602) has no ENS — create provider with ENS disabled
function createOgProvider(): ethers.JsonRpcProvider {
  const network = new ethers.Network("0g-testnet", 16602);
  // Set a dummy ENS address to prevent "network does not support ENS" error
  network.attachPlugin(new ethers.EnsPlugin("0x0000000000000000000000000000000000000000"));
  const provider = new ethers.JsonRpcProvider(getRpcUrl(), network, { staticNetwork: network });
  return provider;
}

function getSignerContract(): ethers.Contract {
  const key = process.env.OG_PRIVATE_KEY!;
  const pk = key.startsWith("0x") ? key : `0x${key}`;
  const provider = createOgProvider();
  const wallet = new ethers.Wallet(pk, provider);
  return new ethers.Contract(getContractAddress(), ABI, wallet);
}

function getReadContract(): ethers.Contract {
  const provider = createOgProvider();
  return new ethers.Contract(getContractAddress(), ABI, provider);
}

// SOUL.md content hash (loaded once)
let _soulContent: string | null = null;

function getSoulContent(): string {
  if (!_soulContent) {
    try {
      _soulContent = readFileSync("./openclaw/main-agent/SOUL.md", "utf-8");
    } catch {
      _soulContent =
        "AlphaDawg Main Agent — autonomous investment agent with adversarial debate, " +
        "TEE-verified inference, and on-chain audit trail.";
    }
  }
  return _soulContent;
}

// ── MINT — called once during user onboarding ─────────────────────

export async function mintAgentNFT(
  userWalletAddress: string,
  proxyWalletAddress: string,
  riskProfile: string,
): Promise<{ tokenId: number; txHash: string }> {
  const contract = getSignerContract();

  const soulHash = keccak256(toUtf8Bytes(getSoulContent()));
  const metadataHash = keccak256(toUtf8Bytes("genesis"));
  const encryptedURI = "0g-storage://genesis";

  console.log(`[iNFT] Minting for proxy ${proxyWalletAddress.slice(0, 10)}...`);

  try {
    const tx = await contract.mintAgent(
      userWalletAddress,
      proxyWalletAddress,
      encryptedURI,
      metadataHash,
      soulHash,
      riskProfile,
    );

    const receipt = await tx.wait();

    // Parse AgentMinted event to get tokenId
    let tokenId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === "AgentMinted") {
          tokenId = Number(parsed.args[0]);
          break;
        }
      } catch {
        // Skip non-matching logs
      }
    }

    console.log(`[iNFT] Minted tokenId=${tokenId} tx=${receipt.hash}`);
    return { tokenId, txHash: receipt.hash };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[iNFT] Mint failed: ${msg.slice(0, 120)}`);
    return { tokenId: 0, txHash: "" };
  }
}

// ── UPDATE METADATA — called after each cycle ─────────────────────

export async function updateAgentMetadata(
  tokenId: number,
  storageRootHash: string,
): Promise<string> {
  if (tokenId === 0) return "";

  const contract = getSignerContract();
  const newHash = keccak256(toUtf8Bytes(storageRootHash));
  const newURI = `0g-storage://${storageRootHash}`;

  try {
    const tx = await contract.updateMetadata(tokenId, newHash, newURI);
    const receipt = await tx.wait();

    const cycles = await contract.cycleCount(tokenId);
    console.log(`[iNFT] Updated tokenId=${tokenId} cycles=${cycles}`);
    return receipt.hash;
  } catch (err) {
    console.error(`[iNFT] Update failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`);
    return "";
  }
}

// ── UPDATE RISK PROFILE ───────────────────────────────────────────

export async function updateAgentRiskProfile(
  tokenId: number,
  newProfile: string,
): Promise<void> {
  if (tokenId === 0) return;

  const contract = getSignerContract();
  try {
    const tx = await contract.updateRiskProfile(tokenId, newProfile);
    await tx.wait();
    console.log(`[iNFT] Risk updated tokenId=${tokenId} → ${newProfile}`);
  } catch (err) {
    console.error(`[iNFT] Risk update failed: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`);
  }
}

// ── READ: full agent info ─────────────────────────────────────────

export async function getAgentInfo(tokenId: number): Promise<{
  owner: string;
  wallet: string;
  metaHash: string;
  uri: string;
  soul: string;
  risk: string;
  cycles: number;
} | null> {
  const contract = getReadContract();
  try {
    const [owner, wallet, metaHash, uri, soul, risk, cycles] =
      await contract.getAgent(tokenId);
    return {
      owner: owner as string,
      wallet: wallet as string,
      metaHash: metaHash as string,
      uri: uri as string,
      soul: soul as string,
      risk: risk as string,
      cycles: Number(cycles),
    };
  } catch {
    return null;
  }
}

// ── READ: IntelligentData (ERC-7857 spec) ─────────────────────────

export async function getIntelligentData(tokenId: number): Promise<
  Array<{ description: string; hash: string }> | null
> {
  const contract = getReadContract();
  try {
    const data = await contract.intelligentDataOf(tokenId);
    return (data as Array<{ dataDescription: string; dataHash: string }>).map((d) => ({
      description: d.dataDescription,
      hash: d.dataHash,
    }));
  } catch {
    return null;
  }
}

// ── READ: lookup by wallet ────────────────────────────────────────

export async function getAgentByWallet(
  proxyWalletAddress: string,
): Promise<number> {
  const contract = getReadContract();
  try {
    return Number(await contract.getAgentByWallet(proxyWalletAddress));
  } catch {
    return 0;
  }
}
