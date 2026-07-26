import type { Abi } from "viem";

import jaccardErc1155_11155111 from "@shared/contracts/11155111/JaccardERC1155.json";
import jaccardSwap_11155111 from "@shared/contracts/11155111/JaccardSwap.json";
import essence_11155111 from "@shared/contracts/11155111/Essence.json";
import scrip_11155111 from "@shared/contracts/11155111/Scrip.json";
import jaccardErc1155_31337 from "@shared/contracts/31337/JaccardERC1155.json";
import jaccardSwap_31337 from "@shared/contracts/31337/JaccardSwap.json";
import essence_31337 from "@shared/contracts/31337/Essence.json";
import scrip_31337 from "@shared/contracts/31337/Scrip.json";

export type ContractName = "JaccardERC1155" | "JaccardSwap" | "Essence" | "Scrip";

export interface ContractArtifact {
  address: `0x${string}`;
  abi: Abi;
}

const REGISTRY: Record<number, Partial<Record<ContractName, ContractArtifact>>> = {
  11155111: {
    JaccardERC1155: jaccardErc1155_11155111 as ContractArtifact,
    JaccardSwap: jaccardSwap_11155111 as ContractArtifact,
    Essence: essence_11155111 as ContractArtifact,
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
