import { Router } from "express";
import { getUserActions, getCycleActions, getUserCycles } from "../../store/action-logger.js";

export function actionRoutes(): Router {
  const router = Router();

  // GET /api/actions/:userId — All actions for a user
  router.get("/:userId", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const actions = await getUserActions(req.params.userId, limit);
      res.json({ actions, total: actions.length });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  // GET /api/actions/cycle/:cycleId — All actions for a specific cycle
  router.get("/cycle/:cycleId", async (req, res) => {
    try {
      const actions = await getCycleActions(req.params.cycleId);
      res.json({ actions, total: actions.length });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  return router;
}

export function cycleDbRoutes(): Router {
  const router = Router();

  // GET /api/cycles/:userId — All cycles for a user (from DB, not HCS)
  router.get("/:userId", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 25), 100);
      const cycles = await getUserCycles(req.params.userId, limit);
      res.json({ cycles, total: cycles.length });
    } catch (err) {
      res.status(500).json({ error: String(err), code: 500 });
    }
  });

  return router;
}
