require("dotenv/config");
require("@nomicfoundation/hardhat-toolbox");

const OG_KEY = process.env.OG_PRIVATE_KEY
  ? process.env.OG_PRIVATE_KEY.startsWith("0x")
    ? process.env.OG_PRIVATE_KEY
    : `0x${process.env.OG_PRIVATE_KEY}`
  : undefined;

const HEDERA_EVM_KEY = process.env.HEDERA_EVM_PRIVATE_KEY
  ? process.env.HEDERA_EVM_PRIVATE_KEY.startsWith("0x")
    ? process.env.HEDERA_EVM_PRIVATE_KEY
    : `0x${process.env.HEDERA_EVM_PRIVATE_KEY}`
  : undefined;

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      // REQUIRED: 0G Chain needs cancun EVM version
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    "og-testnet": {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: OG_KEY ? [OG_KEY] : [],
    },
    "hedera-testnet": {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: HEDERA_EVM_KEY ? [HEDERA_EVM_KEY] : [],
    },
  },
};
