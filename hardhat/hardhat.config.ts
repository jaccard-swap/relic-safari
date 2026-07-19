//import dotenv from "dotenv"
//dotenv.config({ path: "../.env" });
import 'dotenv/config'
import HardhatDeploy from 'hardhat-deploy';
import { deployAuctionTask } from "./tasks/index.js";
import type { HardhatUserConfig } from "hardhat/config";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";

if (!process.env.BASE_SEPOLIA_RPC_URL) {
  throw new Error("BASE_SEPOLIA_RPC_URL is not set");
}

if (!process.env.BASE_RPC_URL) {
  throw new Error("BASE_RPC_URL is not set");
}

if (!process.env.SEPOLIA_RPC_URL) {
  throw new Error("SEPOLIA_RPC_URL is not set");
}

if (!process.env.MNEMONIC) {
  throw new Error("MNEMONIC is not set");
}

if (!process.env.ETHERSCAN_API_KEY) {
  throw new Error("ETHERSCAN_API_KEY is not set");
}

if (!process.env.BASESCAN_API_KEY) {
  throw new Error("BASESCAN_API_KEY is not set");
}

const config: HardhatUserConfig = {
  tasks: [deployAuctionTask],
  plugins: [hardhatToolboxViemPlugin, hardhatVerify, HardhatDeploy],
  solidity: {
    compilers: [
      {
        version: "0.8.10",
      },
      {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  chainDescriptors: {
    84532: {
      name: "Base Sepolia",
      blockExplorers: {
        etherscan: {
          name: "Base Sepolia Explorer",
          url: "https://sepolia.basescan.org",
          apiUrl: "https://api-sepolia.basescan.org/api",
        },
      },
    },
    8453: {
      name: "Base",
      blockExplorers: {
        etherscan: {
          name: "Etherscan",
          url: "https://basescan.io",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
      },
    },
    11155111: {
      name: "Sepolia",
      blockExplorers: {
        etherscan: {
          name: "Sepolia Explorer",
          url: "https://sepolia.basescan.org",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    base: {
      type: "http",
      chainType: "l1",
      url: process.env.BASE_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    baseSepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
    verify: {
      etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
      },
    },
};

export default config;
