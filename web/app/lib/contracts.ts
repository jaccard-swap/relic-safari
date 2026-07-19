import type { Abi } from "viem";

import jaccardErc1155_11155111 from "@shared/contracts/11155111/JaccardERC1155.json";
import jaccardSwap_11155111 from "@shared/contracts/11155111/JaccardSwap.json";
import scrip_11155111 from "@shared/contracts/11155111/MockERC20.json";
import jaccardErc1155_31337 from "@shared/contracts/31337/JaccardERC1155.json";
import jaccardSwap_31337 from "@shared/contracts/31337/JaccardSwap.json";
import essence_31337 from "@shared/contracts/31337/Essence.json";
import scrip_31337 from "@shared/contracts/31337/MockERC20.json";

export type ContractName = "JaccardERC1155" | "JaccardSwap" | "Essence" | "Scrip";

export interface ContractArtifact {
  address: `0x${string}`;
  abi: Abi;
}

// Sepolia (11155111) hasn't been redeployed since the Essence facet was
// added - that contract is missing there until the next real deploy. 31337
// (local anvil/hardhat) is regenerated fresh by hardhat/deploy on every
// local deploy run, so it always has the full current facet set.
const REGISTRY: Record<number, Partial<Record<ContractName, ContractArtifact>>> = {
  11155111: {
    JaccardERC1155: jaccardErc1155_11155111 as ContractArtifact,
    JaccardSwap: jaccardSwap_11155111 as ContractArtifact,
    // No dedicated "Scrip" deployment - MockERC20 stands in for it (see
    // hardhat/deploy/00_deploy_diamond.ts).
    Scrip: scrip_11155111 as ContractArtifact,
  },
  31337: {
    JaccardERC1155: jaccardErc1155_31337 as ContractArtifact,
    JaccardSwap: jaccardSwap_31337 as ContractArtifact,
    Essence: essence_31337 as ContractArtifact,
    Scrip: scrip_31337 as ContractArtifact,
  },
};

export function getContract(chainId: number, name: ContractName): ContractArtifact | null {
  return REGISTRY[chainId]?.[name] ?? null;
}
