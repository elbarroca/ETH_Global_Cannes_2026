import { Router } from "express";
import { getUserById } from "../../store/user-store";
import { getHistoryForUser } from "../../hedera/hcs";
import { analyzeCycle, commitCycle, rejectCycle, runCycle } from "../../agents/main-agent";
import {
  createPendingCycle,
  getPendingCycle,
  getPendingForUser,
  resolvePendingCycle,
} from "../../store/pending-cycles";

function getTopicId(): string {
  return process.env.HCS_AUDIT_TOPIC_ID ?? "";
}

export function cycleRoutes(): Router {
  const router = Router();

  // GET /api/cycle/latest/:userId — Latest cycle for specific user
  router.get("/latest/:userId", async (req, res) => {
    try {
      const user = await getUserById(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      const topicId = getTopicId();
      if (!topicId) {
        res.status(500).json({ error: "HCS_AUDIT_TOPIC_ID not configured", code: 500 });
        return;
      }

      const history = await getHistoryForUser(topicId, user.id, 1);
      if (history.length === 0) {
        res.json(null);
        return;
      }

      res.json(history[0]);
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // GET /api/cycle/history/:userId?limit=10 — Historical cycles for user
  router.get("/history/:userId", async (req, res) => {
    try {
      const user = await getUserById(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      const topicId = getTopicId();
      if (!topicId) {
        res.status(500).json({ error: "HCS_AUDIT_TOPIC_ID not configured", code: 500 });
        return;
      }

      const limit = Math.min(Number(req.query.limit ?? 10), 100);
      const history = await getHistoryForUser(topicId, user.id, limit);

      res.json(history);
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // POST /api/cycle/run/:userId — Trigger immediate cycle (backward compat: auto-approve for "auto" mode)
  router.post("/run/:userId", async (req, res) => {
    try {
      const user = await getUserById(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      const approvalMode = user.agent.approvalMode ?? "always";

      if (approvalMode === "auto") {
        // Legacy behavior — full cycle, no pause
        console.log(`[api] Auto-approve cycle for user ${user.id}`);
        const result = await runCycle(user);
        res.json({
          cycleId: result.cycleId,
          specialists: result.specialists,
          debate: result.debate,
          decision: result.decision,
          seqNum: result.seqNum,
          hashscanUrl: result.hashscanUrl,
          timestamp: result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
        });
        return;
      }

      // Two-phase: analyze + create pending
      console.log(`[api] Analyze cycle for user ${user.id} (approval: ${approvalMode})`);
      const analysis = await analyzeCycle(user);
      const timeoutMin = user.agent.approvalTimeoutMin ?? 10;
      const pending = await createPendingCycle(analysis, "ui", timeoutMin);

      res.json({
        pendingId: pending.id,
        cycleNumber: pending.cycleNumber,
        status: pending.status,
        specialists: pending.specialists,
        debate: pending.debate,
        compactRecord: pending.compactRecord,
        expiresAt: pending.expiresAt,
      });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // POST /api/cycle/analyze/:userId — Analyze only (Phase 1)
  router.post("/analyze/:userId", async (req, res) => {
    try {
      const user = await getUserById(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      // Guard: reject if user already has a pending cycle
      const existing = await getPendingForUser(user.id);
      if (existing) {
        res.status(409).json({ error: "A pending cycle already exists. Approve or reject it first.", code: 409, pendingId: existing.id });
        return;
      }

      console.log(`[api] Analyze cycle for user ${user.id}`);
      const analysis = await analyzeCycle(user);
      const timeoutMin = user.agent.approvalTimeoutMin ?? 10;
      const pending = await createPendingCycle(analysis, "ui", timeoutMin);

      res.json({
        pendingId: pending.id,
        cycleNumber: pending.cycleNumber,
        status: pending.status,
        specialists: pending.specialists,
        debate: pending.debate,
        compactRecord: pending.compactRecord,
        expiresAt: pending.expiresAt,
      });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // POST /api/cycle/approve/:pendingId — Approve pending cycle (Phase 2)
  router.post("/approve/:pendingId", async (req, res) => {
    try {
      const pending = await getPendingCycle(req.params.pendingId);
      if (!pending) {
        res.status(404).json({ error: "Pending cycle not found", code: 404 });
        return;
      }

      // Auth: verify caller owns this pending cycle
      const callerId = req.body?.userId as string | undefined;
      if (!callerId || callerId !== pending.userId) {
        res.status(403).json({ error: "Not authorized to approve this cycle", code: 403 });
        return;
      }

      const user = await getUserById(pending.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      // Validate modifiedPct bounds
      const modifiedPct = req.body?.modifiedPct as number | undefined;
      if (modifiedPct !== undefined) {
        if (modifiedPct < 0 || modifiedPct > user.agent.maxTradePercent) {
          res.status(400).json({ error: `modifiedPct must be 0-${user.agent.maxTradePercent}`, code: 400 });
          return;
        }
      }

      // Atomically resolve FIRST to prevent double-commit
      const resolved = await resolvePendingCycle(pending.id, {
        status: "APPROVED",
        resolvedBy: "user",
        modifiedPct,
      });
      if (!resolved) {
        res.status(409).json({ error: "Already resolved by another session", code: 409 });
        return;
      }

      // Safe to commit — only one caller reaches here
      const analysis = {
        userId: pending.userId,
        cycleId: pending.cycleNumber,
        goal: pending.goal,
        specialists: pending.specialists,
        debate: pending.debate,
        compactRecord: pending.compactRecord,
        richRecord: pending.richRecord,
      };

      try {
        const result = await commitCycle(analysis, user, modifiedPct);
        res.json({
          cycleId: result.cycleId,
          specialists: result.specialists,
          debate: result.debate,
          decision: result.decision,
          seqNum: result.seqNum,
          hashscanUrl: result.hashscanUrl,
          timestamp: result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
        });
      } catch (commitErr) {
        // commitCycle failed AFTER resolve — advance lastCycleId to prevent reuse
        console.error("[api] commitCycle failed after resolve, cleaning up:", commitErr);
        await rejectCycle(analysis, user, "commit_failed").catch(() => {});
        res.status(500).json({ error: "Commit failed after approval. Cycle logged as failed.", code: 500 });
      }
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // POST /api/cycle/reject/:pendingId — Reject pending cycle
  router.post("/reject/:pendingId", async (req, res) => {
    try {
      const pending = await getPendingCycle(req.params.pendingId);
      if (!pending) {
        res.status(404).json({ error: "Pending cycle not found", code: 404 });
        return;
      }

      // Auth: verify caller owns this pending cycle
      const callerId = req.body?.userId as string | undefined;
      if (!callerId || callerId !== pending.userId) {
        res.status(403).json({ error: "Not authorized to reject this cycle", code: 403 });
        return;
      }

      const user = await getUserById(pending.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      const reason = (req.body?.reason as string) ?? "user_rejected";

      // Atomically resolve FIRST
      const resolved = await resolvePendingCycle(pending.id, {
        status: "REJECTED",
        resolvedBy: "user",
        rejectReason: reason,
      });
      if (!resolved) {
        res.status(409).json({ error: "Already resolved by another session", code: 409 });
        return;
      }

      await rejectCycle(
        {
          userId: pending.userId,
          cycleId: pending.cycleNumber,
          goal: pending.goal,
          specialists: pending.specialists,
          debate: pending.debate,
          compactRecord: pending.compactRecord,
          richRecord: pending.richRecord,
        },
        user,
        reason,
      );

      await resolvePendingCycle(pending.id, {
        status: "REJECTED",
        resolvedBy: "user",
        rejectReason: reason,
      });

      res.json({ status: "rejected", pendingId: pending.id });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // GET /api/cycle/pending/:userId — Get current pending cycle
  router.get("/pending/:userId", async (req, res) => {
    try {
      const pending = await getPendingForUser(req.params.userId);
      if (!pending) {
        res.json(null);
        return;
      }

      res.json({
        pendingId: pending.id,
        cycleNumber: pending.cycleNumber,
        status: pending.status,
        specialists: pending.specialists,
        debate: pending.debate,
        compactRecord: pending.compactRecord,
        expiresAt: pending.expiresAt,
      });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  return router;
}
