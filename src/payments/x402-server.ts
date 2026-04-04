import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const NETWORK = "eip155:2655" as const;

export function createSpecialistServer(
  name: string,
  port: number,
  payTo: string,
  price: string,
  handler: () => Promise<object>
): void {
  const app = express();

  const facilitatorClient = new HTTPFacilitatorClient({
    url: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
  });

  const server = new x402ResourceServer(facilitatorClient).register(
    NETWORK,
    new ExactEvmScheme()
  );

  app.use(
    paymentMiddleware(
      {
        "GET /analyze": {
          accepts: {
            scheme: "exact",
            payTo,
            price,
            network: NETWORK,
          },
          description: `${name} specialist analysis`,
        },
      },
      server
    )
  );

  app.get("/analyze", async (_req, res) => {
    try {
      const result = await handler();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.listen(port, () => console.log(`${name} specialist on :${port}`));
}
