import { Router } from "express";
import { getUserById, updateUser } from "../../store/user-store.js";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

export function fundRoutes(): Router {
  const router = Router();

  // POST /api/deposit — Deposit USDC, activate agent
  router.post("/deposit", (req, res) => {
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

      const user = getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      // Update fund record + activate agent
      // HTS minting deferred to Sprint 4 — for now just update balances
      const updated = updateUser(userId, {
        fund: {
          depositedUsdc: user.fund.depositedUsdc + amount,
          currentNav: user.fund.currentNav + amount,
          htsShareBalance: user.fund.htsShareBalance + amount, // 1:1 until HTS mint
        },
        agent: { active: true },
      });

      res.json({
        success: true,
        depositedUsdc: updated.fund.depositedUsdc,
        htsShareBalance: updated.fund.htsShareBalance,
        currentNav: updated.fund.currentNav,
        agentActive: updated.agent.active,
        note: "HTS share minting will be wired in Sprint 4",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg, code: 500 });
    }
  });

  // POST /api/withdraw — Withdraw USDC, deactivate if full withdrawal
  router.post("/withdraw", (req, res) => {
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

      const user = getUserById(userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      if (amount > user.fund.depositedUsdc) {
        res.status(400).json({ error: "Insufficient balance", code: 400 });
        return;
      }

      const newDeposit = user.fund.depositedUsdc - amount;
      const fee = amount * 0.01; // 1% fee
      const netWithdraw = amount - fee;
      const fullWithdrawal = newDeposit <= 0;

      const updated = updateUser(userId, {
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
        note: "HTS share burning will be wired in Sprint 4",
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
          const tokenRes = await fetch(`${MIRROR_BASE}/tokens/${tokenId}`);
          if (tokenRes.ok) {
            const data = (await tokenRes.json()) as {
              name: string;
              symbol: string;
              decimals: string;
              total_supply: string;
              token_id: string;
              custom_fees?: { fixed_fees?: unknown[]; fractional_fees?: unknown[] };
            };
            tokenInfo = {
              name: data.name,
              symbol: data.symbol,
              decimals: Number(data.decimals),
              totalSupply: data.total_supply,
              tokenId: data.token_id,
              customFees: data.custom_fees ?? null,
            };
          }
        } catch { /* non-fatal */ }
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
