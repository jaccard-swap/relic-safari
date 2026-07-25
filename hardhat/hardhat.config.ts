import { config as loadEnv } from "dotenv";
// hardhat/ is a workspace inside the relic-safari monorepo - load the
// shared root .env instead of expecting a separate one nested in here.
loadEnv({ path: `${import.meta.dirname}/../.env` });
import HardhatDeploy from 'hardhat-deploy';
import { changeOwnershipTask } from "./tasks/index.js";
import type { HardhatUserConfig } from "hardhat/config";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";

if (!process.env.SEPOLIA_RPC_URL) {
  throw new Error("SEPOLIA_RPC_URL is not set");
}

if (!process.env.MNEMONIC) {
  throw new Error("MNEMONIC is not set");
}

if (!process.env.ETHERSCAN_API_KEY) {
  throw new Error("ETHERSCAN_API_KEY is not set");
}

if (!process.env.LOCALHOST_RPC_URL) {
  throw new Error("LOCALHOST_RPC_URL is not set");
}

if (!process.env.MNEMONIC_LOCALHOST) {
  throw new Error("MNEMONIC_LOCALHOST is not set");
}

const config: HardhatUserConfig = {
  tasks: [changeOwnershipTask],
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
    11155111: {
      name: "Sepolia",
      blockExplorers: {
        etherscan: {
          name: "Sepolia Explorer",
          url: "https://sepolia.etherscan.io",
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
    // Anvil (chainId 31337). LOCALHOST_RPC_URL is http://127.0.0.1:8545 for
    // a host-run anvil, or http://anvil:8545 when the deploy container talks
    // to the anvil compose service by name. MNEMONIC_LOCALHOST is the
    // well-known Anvil/Hardhat test mnemonic - never the real deployer
    // mnemonic - since anvil state (and its funded accounts) is throwaway.
    localhost: {
      type: "http",
      chainType: "l1",
      url: process.env.LOCALHOST_RPC_URL,
      accounts: {
        mnemonic: process.env.MNEMONIC_LOCALHOST,
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
