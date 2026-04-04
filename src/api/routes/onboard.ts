import { Router } from "express";
import { ethers } from "ethers";
import {
  getUserByWallet,
  createUser,
  updateUser,
  getAllUsers,
  getActiveUsers,
} from "../../store/user-store";
import { createProxyWallet } from "../../payments/circle-wallet";
import { generateLinkCode } from "../../store/link-codes";
import { mintAgentNFT } from "../../og/inft";
import type { UserRecord } from "../../types/index";

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
      const existing = await getUserByWallet(walletAddress);
      if (existing) {
        const linkCode = await generateLinkCode(existing.id);
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

      // Create Circle proxy wallet and user record
      // Generate userId FIRST so Circle wallet refId matches the stored user ID
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
            await updateUser(user.id, { inftTokenId });
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

  // POST /api/configure — Set risk profile, notification preference, approval mode
  router.post("/configure", async (req, res) => {
    try {
      const { userId, riskProfile, notifyPreference, approvalMode, approvalTimeoutMin, cycleCount, cyclePeriodMs } = req.body as {
        userId?: string;
        riskProfile?: string;
        notifyPreference?: string;
        approvalMode?: string;
        approvalTimeoutMin?: number;
        cycleCount?: number;
        cyclePeriodMs?: number;
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

      const validApprovalModes = ["always", "trades_only", "auto"];
      if (approvalMode && !validApprovalModes.includes(approvalMode)) {
        res.status(400).json({ error: `approvalMode must be one of: ${validApprovalModes.join(", ")}`, code: 400 });
        return;
      }

      if (approvalTimeoutMin !== undefined && (approvalTimeoutMin < 1 || approvalTimeoutMin > 60)) {
        res.status(400).json({ error: "approvalTimeoutMin must be between 1 and 60", code: 400 });
        return;
      }

      if (cycleCount !== undefined && (cycleCount < 0 || cycleCount > 100)) {
        res.status(400).json({ error: "cycleCount must be between 0 and 100", code: 400 });
        return;
      }

      const validPeriods = [300000, 900000, 1800000, 3600000]; // 5m, 15m, 30m, 1h
      if (cyclePeriodMs !== undefined && !validPeriods.includes(cyclePeriodMs)) {
        res.status(400).json({ error: `cyclePeriodMs must be one of: ${validPeriods.join(", ")}`, code: 400 });
        return;
      }

      const patch: {
        agent?: Partial<UserRecord["agent"]>;
        telegram?: Partial<UserRecord["telegram"]>;
      } = {};

      if (riskProfile || approvalMode || approvalTimeoutMin !== undefined || cycleCount !== undefined || cyclePeriodMs !== undefined) {
        patch.agent = {};
        if (riskProfile) {
          patch.agent.riskProfile = riskProfile as UserRecord["agent"]["riskProfile"];
          patch.agent.maxTradePercent = deriveMaxTrade(riskProfile);
        }
        if (approvalMode) {
          patch.agent.approvalMode = approvalMode as UserRecord["agent"]["approvalMode"];
        }
        if (approvalTimeoutMin !== undefined) {
          patch.agent.approvalTimeoutMin = approvalTimeoutMin;
        }
        if (cycleCount !== undefined) {
          patch.agent.cycleCount = cycleCount;
          patch.agent.cyclesRemaining = cycleCount;
        }
        if (cyclePeriodMs !== undefined) {
          patch.agent.cyclePeriodMs = cyclePeriodMs;
        }
      }

      if (notifyPreference) {
        patch.telegram = {
          notifyPreference: notifyPreference as UserRecord["telegram"]["notifyPreference"],
        };
      }

      const updated = await updateUser(userId, patch);
      res.json({ success: true, user: sanitizeUser(updated) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = msg.includes("not found") ? 404 : 500;
      res.status(status).json({ error: msg, code: status });
    }
  });

  // GET /api/user/:walletAddress — Retrieve user record (sanitized)
  router.get("/user/:walletAddress", async (req, res) => {
    try {
      const user = await getUserByWallet(req.params.walletAddress);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }
      res.json(sanitizeUser(user));
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // GET /api/stats — System-wide statistics
  router.get("/stats", async (_req, res) => {
    const all = await getAllUsers();
    const active = await getActiveUsers();
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
