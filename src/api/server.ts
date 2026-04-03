import express from "express";
import { loadStore } from "../store/user-store.js";
import { onboardRoutes } from "./routes/onboard.js";
import { cycleRoutes } from "./routes/cycle.js";
import { fundRoutes } from "./routes/fund.js";

const PORT = Number(process.env.SERVER_PORT ?? 3001);

export function createApiServer(): express.Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });
  app.options("*", (_req, res) => res.sendStatus(204));

  // Routes
  app.use("/api", onboardRoutes());
  app.use("/api/cycle", cycleRoutes());
  app.use("/api", fundRoutes());

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] Unhandled error:", err);
    res.status(500).json({ error: err.message, code: 500 });
  });

  return app;
}

export function startApiServer(): void {
  loadStore();
  const app = createApiServer();
  app.listen(PORT, () => {
    console.log(`[api] Express server listening on :${PORT}`);
  });
}
