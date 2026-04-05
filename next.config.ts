import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@hashgraph/sdk",
    "@0glabs/0g-serving-broker",
    "@0gfoundation/0g-ts-sdk",
    "@circle-fin/developer-controlled-wallets",
    "@prisma/client",
    "@x402/express",
    "@x402/evm",
    "@x402/fetch",
    "@x402/core",
    "postgres",
    "node-telegram-bot-api",
    "ethers",
    "crypto-js",
    "express",
    "@circle-fin/x402-batching",
  ],
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
  },
};

export default nextConfig;
