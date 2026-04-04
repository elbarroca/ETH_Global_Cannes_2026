import { Router } from "express";
import { getUserById } from "../../store/user-store.js";
import { getHistoryForUser } from "../../hedera/hcs.js";
import { runCycle } from "../../agents/main-agent.js";

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

  // POST /api/cycle/run/:userId — Trigger immediate cycle
  router.post("/run/:userId", async (req, res) => {
    try {
      const user = await getUserById(req.params.userId);
      if (!user) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      console.log(`[api] Manual cycle triggered for user ${user.id}`);
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
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  return router;
}
