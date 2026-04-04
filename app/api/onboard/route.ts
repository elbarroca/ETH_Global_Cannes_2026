import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getUserByWallet, createUser, updateUser } from "@/src/store/user-store";
import { createProxyWallet } from "@/src/payments/circle-wallet";
import { generateLinkCode } from "@/src/store/link-codes";
import { mintAgentNFT } from "@/src/og/inft";

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, signature, message } = (await req.json()) as {
      walletAddress?: string;
      signature?: string;
      message?: string;
    };

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    // Return existing user
    const existing = await getUserByWallet(walletAddress);
    if (existing) {
      const linkCode = await generateLinkCode(existing.id);
      return NextResponse.json({
        userId: existing.id,
        proxyWalletAddress: existing.proxyWallet.address,
        telegramLinkCode: linkCode,
        existing: true,
      });
    }

    // Verify signature (skip for testnet "mock")
    if (signature && message && signature !== "mock") {
      try {
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
          return NextResponse.json({ error: "Signature does not match wallet address" }, { status: 401 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const newUserId = crypto.randomUUID();
    let proxyWallet: { walletId: string; address: string };
    try {
      proxyWallet = await createProxyWallet(newUserId);
    } catch (err) {
      console.warn("[onboard] Circle wallet creation failed, using placeholder:", err instanceof Error ? err.message : String(err));
      proxyWallet = { walletId: `local-${newUserId}`, address: `0x${newUserId.replace(/-/g, "").slice(0, 40)}` };
    }

    const user = await createUser(walletAddress, proxyWallet, newUserId);
    const linkCode = await generateLinkCode(user.id);

    // Mint iNFT agent identity on 0G Chain (non-fatal)
    let inftTokenId: number | null = null;
    if (process.env.INFT_CONTRACT_ADDRESS) {
      try {
        const { tokenId } = await mintAgentNFT(walletAddress, proxyWallet.address, "balanced");
        if (tokenId > 0) {
          inftTokenId = tokenId;
          await updateUser(user.id, { inftTokenId });
        }
      } catch (err) {
        console.warn("[onboard] iNFT mint skipped:", err instanceof Error ? err.message : String(err));
      }
    }

    return NextResponse.json(
      { userId: user.id, proxyWalletAddress: proxyWallet.address, telegramLinkCode: linkCode, inftTokenId, existing: false },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
