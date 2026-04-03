import { Router } from "express";
import { ethers } from "ethers";
import {
  getUserByWallet,
  createUser,
  updateUser,
  getAllUsers,
  getActiveUsers,
} from "../../store/user-store.js";
import { generateProxyWallet } from "../../store/proxy-wallet.js";
import { generateLinkCode } from "../../store/link-codes.js";
import { mintAgentNFT } from "../../og/inft.js";
import type { UserRecord } from "../../types/index.js";

function sanitizeUser(user: UserRecord) {
  const { proxyWallet, ...rest } = user;
  return { ...rest, proxyWalletAddress: proxyWallet.address };
}

function deriveMaxTrade(riskProfile: string): number {
  if (riskProfile === "conservative") return 5;
  if (riskProfile === "aggressive") return 25;
  return 12; // balanced
}

export function onboardRoutes(): Router {
  const router = Router();

  // POST /api/onboard — Create new user with wallet verification
  router.post("/onboard", async (req, res) => {
    try {
      const { walletAddress, signature, message } = req.body as {
        walletAddress?: string;
        signature?: string;
        message?: string;
      };

      if (!walletAddress) {
        res.status(400).json({ error: "walletAddress is required", code: 400 });
        return;
      }

      // Check existing user
      const existing = getUserByWallet(walletAddress);
      if (existing) {
        const linkCode = generateLinkCode(existing.id);
        res.json({
          userId: existing.id,
          proxyWalletAddress: existing.proxyWallet.address,
          telegramLinkCode: linkCode,
          existing: true,
        });
        return;
      }

      // Verify wallet signature (optional — skip if not provided or on testnet)
      if (signature && message && signature !== "mock") {
        try {
          const recovered = ethers.verifyMessage(message, signature);
          if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
            res.status(401).json({ error: "Signature does not match wallet address", code: 401 });
            return;
          }
        } catch {
          res.status(401).json({ error: "Invalid signature", code: 401 });
          return;
        }
      }

      // Generate proxy wallet and create user
      const proxyWallet = generateProxyWallet();
      const user = createUser(walletAddress, proxyWallet);
      const linkCode = generateLinkCode(user.id);

      // Mint iNFT for the agent (non-fatal)
      let inftTokenId: number | null = null;
      if (process.env.INFT_CONTRACT_ADDRESS) {
        try {
          const { tokenId } = await mintAgentNFT(
            walletAddress,
            proxyWallet.address,
            "balanced",
          );
          if (tokenId > 0) {
            inftTokenId = tokenId;
            updateUser(user.id, { inftTokenId });
          }
        } catch (err) {
          console.warn("[onboard] iNFT mint skipped:", err instanceof Error ? err.message : String(err));
        }
      }

      res.status(201).json({
        userId: user.id,
        proxyWalletAddress: proxyWallet.address,
        telegramLinkCode: linkCode,
        inftTokenId,
        existing: false,
      });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // POST /api/configure — Set risk profile and notification preference
  router.post("/configure", (req, res) => {
    try {
      const { userId, riskProfile, notifyPreference } = req.body as {
        userId?: string;
        riskProfile?: string;
        notifyPreference?: string;
      };

      if (!userId) {
        res.status(400).json({ error: "userId is required", code: 400 });
        return;
      }

      const validProfiles = ["conservative", "balanced", "aggressive"];
      if (riskProfile && !validProfiles.includes(riskProfile)) {
        res.status(400).json({ error: `riskProfile must be one of: ${validProfiles.join(", ")}`, code: 400 });
        return;
      }

      const validNotify = ["every_cycle", "trades_only", "daily"];
      if (notifyPreference && !validNotify.includes(notifyPreference)) {
        res.status(400).json({ error: `notifyPreference must be one of: ${validNotify.join(", ")}`, code: 400 });
        return;
      }

      const patch: {
        agent?: Partial<UserRecord["agent"]>;
        telegram?: Partial<UserRecord["telegram"]>;
      } = {};

      if (riskProfile) {
        patch.agent = {
          riskProfile: riskProfile as UserRecord["agent"]["riskProfile"],
          maxTradePercent: deriveMaxTrade(riskProfile),
        };
      }

      if (notifyPreference) {
        patch.telegram = {
          notifyPreference: notifyPreference as UserRecord["telegram"]["notifyPreference"],
        };
      }

      const updated = updateUser(userId, patch);
      res.json({ success: true, user: sanitizeUser(updated) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.includes("not found") ? 404 : 500;
      res.status(status).json({ error: msg, code: status });
    }
  });

  // GET /api/user/:walletAddress — Retrieve user record (sanitized)
  router.get("/user/:walletAddress", (req, res) => {
    const user = getUserByWallet(req.params.walletAddress);
    if (!user) {
      res.status(404).json({ error: "User not found", code: 404 });
      return;
    }
    res.json(sanitizeUser(user));
  });

  // GET /api/stats — System-wide statistics
  router.get("/stats", (_req, res) => {
    const all = getAllUsers();
    const active = getActiveUsers();
    const totalCycles = all.reduce((sum, u) => sum + u.agent.lastCycleId, 0);
    const totalValue = all.reduce((sum, u) => sum + u.fund.depositedUsdc, 0);

    res.json({
      totalUsers: all.length,
      activeAgents: active.length,
      totalCyclesRun: totalCycles,
      totalValueLocked: totalValue,
    });
  });

  return router;
}
