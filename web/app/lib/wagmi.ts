import { http, createConfig } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Dev additionally wires up the local hardhat chain so the app is usable
// against `npx hardhat node` without a testnet - but Sepolia stays
// available in both, since that's the only chain the API's server-signed
// endpoints (faucet mint, polymerase) currently talk to.
export const wagmiConfig = import.meta.env.DEV
  ? createConfig({
      chains: [sepolia, hardhat],
      connectors: [injected()],
      transports: {
        [sepolia.id]: http(),
        [hardhat.id]: http(),
      },
    })
  : createConfig({
      chains: [sepolia],
      connectors: [injected()],
      transports: {
        [sepolia.id]: http(),
      },
    });

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
