import "dotenv/config";
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";

export function createSpecialistServer(
  name: string,
  port: number,
  payTo: string,
  price: string,
  handler: () => Promise<object>
): void {
  const app = express();
  app.use(express.json({ limit: "64kb" }));

  // Circle Gateway nanopayments — gas-free batched settlement
  // Handles scheme registration, facilitator sync, and extra metadata automatically
  const gateway = createGatewayMiddleware({
    sellerAddress: payTo,
    description: `${name} specialist analysis`,
  });

  // POST /analyze — client sends { task } in body and pays via x402/Circle Gateway.
  // Previously this was GET, which caused every hire-specialist call to 405 and
  // silently fall back to HOLD/http-failed. The handler doesn't use the task
  // string today (specialists fetch their own data by identity), but we accept
  // the body so clients can pass context without breaking the contract.
  app.post("/analyze", gateway.require(price), async (_req, res) => {
    try {
      const result = await handler();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.listen(port, () => console.log(`${name} specialist on :${port}`));
}
