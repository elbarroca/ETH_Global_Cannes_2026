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

  // Circle Gateway nanopayments — gas-free batched settlement
  // Handles scheme registration, facilitator sync, and extra metadata automatically
  const gateway = createGatewayMiddleware({
    sellerAddress: payTo,
    description: `${name} specialist analysis`,
  });

  app.get("/analyze", gateway.require(price), async (_req, res) => {
    try {
      const result = await handler();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.listen(port, () => console.log(`${name} specialist on :${port}`));
}
