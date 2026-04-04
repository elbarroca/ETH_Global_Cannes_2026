import { Router } from "express";
import { getUserById, updateUser } from "../../store/user-store";
import { mintShares, burnShares, grantKyc, getTokenInfo } from "../../hedera/hts";
import { agentTransfer } from "../../payments/circle-wallet";
import { getOperatorId } from "../../config/hedera";

// Cache token decimals — fetched once on first deposit/withdraw
let cachedDecimals: number | null = null;
async function getDecimals(): Promise<number> {
  if (cachedDecimals === null) {
    const info = await getTokenInfo();
    cachedDecimals = info.decimals;
  }
  return cachedDecimals;
}

export function fundRoutes(): Router {
  const router = Router();

  // POST /api/deposit — Deposit USDC, mint HTS shares, activate agent
  router.post("/deposit", async (req, res) => {
    try {
      const { userId, amount } = req.body as { userId?: string; amount?: number };

      if (!userId || amount == null) {
        res.status(400).json({ error: "userId and amount are required", code: 400 });
        return;
      }

      if (amount <= 0) {
        res.status(400).json({ error: "amount must be positive", code: 400 });
        return;
      }

      const user = await getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      // Grant KYC to operator treasury (first time — grantKyc handles "already granted" internally)
      try {
        await grantKyc(getOperatorId().toString());
      } catch (kycErr) {
        console.warn("[fund] KYC grant failed:", kycErr instanceof Error ? kycErr.message : String(kycErr));
      }

      // Mint HTS shares (convert USDC to smallest token unit)
      const decimals = await getDecimals();
      const shareUnits = Math.round(amount * Math.pow(10, decimals));
      const { newTotalSupply } = await mintShares(shareUnits);

      const updated = await updateUser(userId, {
        fund: {
          depositedUsdc: user.fund.depositedUsdc + amount,
          currentNav: user.fund.currentNav + amount,
          htsShareBalance: user.fund.htsShareBalance + amount,
        },
        agent: { active: true },
      });

      res.json({
        success: true,
        depositedUsdc: updated.fund.depositedUsdc,
        htsShareBalance: updated.fund.htsShareBalance,
        currentNav: updated.fund.currentNav,
        agentActive: updated.agent.active,
        htsTotalSupply: newTotalSupply,
        txStatus: "minted",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg, code: 500 });
    }
  });

  // POST /api/withdraw — Burn HTS shares, transfer USDC via Circle, withdraw
  router.post("/withdraw", async (req, res) => {
    try {
      const { userId, amount } = req.body as { userId?: string; amount?: number };

      if (!userId || amount == null) {
        res.status(400).json({ error: "userId and amount are required", code: 400 });
        return;
      }

      if (amount <= 0) {
        res.status(400).json({ error: "amount must be positive", code: 400 });
        return;
      }

      const user = await getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      if (amount > user.fund.depositedUsdc) {
        res.status(400).json({ error: "Insufficient balance", code: 400 });
        return;
      }

      // Burn HTS shares (convert USDC to smallest token unit)
      const decimals = await getDecimals();
      const shareUnits = Math.round(amount * Math.pow(10, decimals));
      const { newTotalSupply } = await burnShares(shareUnits);

      const newDeposit = user.fund.depositedUsdc - amount;
      const fee = amount * 0.01; // 1% fee (also enforced on-chain via CustomFractionalFee)
      const netWithdraw = amount - fee;
      const fullWithdrawal = newDeposit <= 0;

      // Transfer USDC back to user's wallet via Circle
      let txResult: { txId: string; state: string } | null = null;
      try {
        txResult = await agentTransfer(
          user.proxyWallet.walletId,
          user.walletAddress,
          netWithdraw.toString(),
        );
      } catch (err) {
        console.warn("[fund] Circle transfer failed (non-fatal):", err instanceof Error ? err.message : String(err));
      }

      const updated = await updateUser(userId, {
        fund: {
          depositedUsdc: newDeposit,
          currentNav: Math.max(0, user.fund.currentNav - amount),
          htsShareBalance: Math.max(0, user.fund.htsShareBalance - amount),
        },
        agent: fullWithdrawal ? { active: false } : {},
      });

      res.json({
        success: true,
        withdrawn: netWithdraw,
        fee,
        remainingUsdc: updated.fund.depositedUsdc,
        agentActive: updated.agent.active,
        htsTotalSupply: newTotalSupply,
        txStatus: txResult ? "transferred" : "burned_only",
        circleTxId: txResult?.txId ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg, code: 500 });
    }
  });

  // GET /api/fund/info — Fund token info from HTS
  router.get("/fund/info", async (_req, res) => {
    try {
      const tokenId = process.env.HTS_FUND_TOKEN_ID;
      let tokenInfo = null;

      if (tokenId) {
        try {
          tokenInfo = await getTokenInfo();
        } catch {
          // Non-fatal — token query may fail on cold start
        }
      }

      res.json({
        token: tokenInfo,
        tokenId: tokenId ?? null,
      });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  return router;
}
