import { http, createConfig } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Dev runs solely against the local hardhat chain (`npx hardhat node` /
// the anvil docker service) - no need to also offer Sepolia there. Prod
// stays Sepolia-only.
export const wagmiConfig = import.meta.env.DEV
  ? createConfig({
      chains: [hardhat],
      connectors: [injected()],
      transports: {
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
