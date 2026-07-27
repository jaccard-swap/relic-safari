import type { Abi } from "viem";

import jaccardErc1155_11155111 from "@shared/contracts/11155111/JaccardERC1155.json";
import jaccardSwap_11155111 from "@shared/contracts/11155111/JaccardSwap.json";
import essence_11155111 from "@shared/contracts/11155111/Essence.json";
import scrip_11155111 from "@shared/contracts/11155111/Scrip.json";
import uniswapV2Factory_11155111 from "@shared/contracts/11155111/UniswapV2Factory.json";
import uniswapV2Router02_11155111 from "@shared/contracts/11155111/UniswapV2Router02.json";
import scripEssencePair_11155111 from "@shared/contracts/11155111/ScripEssencePair.json";
import jaccardErc1155_31337 from "@shared/contracts/31337/JaccardERC1155.json";
import jaccardSwap_31337 from "@shared/contracts/31337/JaccardSwap.json";
import essence_31337 from "@shared/contracts/31337/Essence.json";
import scrip_31337 from "@shared/contracts/31337/Scrip.json";
import uniswapV2Factory_31337 from "@shared/contracts/31337/UniswapV2Factory.json";
import uniswapV2Router02_31337 from "@shared/contracts/31337/UniswapV2Router02.json";
import scripEssencePair_31337 from "@shared/contracts/31337/ScripEssencePair.json";
import badges_31337 from "@shared/contracts/31337/Badges.json";

// UniswapV2Factory/Router02/ScripEssencePair aren't deployed by us - they're
// hardhat/scripts/create-uniswap-pool.ts pointing at Uniswap's real Sepolia
// V2 deployment (and, locally, the same real contracts via anvil's Sepolia
// fork - see docker-compose.dev.yaml).
//
// Badges is 31337-only for now - it needs a real Sepolia deploy of the new
// CollectionFacet/BadgesFacet (shared/contracts/11155111/Badges.json)
// before it can be wired up there too, same sequencing as Uniswap above.
export type ContractName =
  | "JaccardERC1155"
  | "JaccardSwap"
  | "Essence"
  | "Scrip"
  | "UniswapV2Factory"
  | "UniswapV2Router02"
  | "ScripEssencePair"
  | "Badges";

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
    UniswapV2Factory: uniswapV2Factory_11155111 as ContractArtifact,
    UniswapV2Router02: uniswapV2Router02_11155111 as ContractArtifact,
    ScripEssencePair: scripEssencePair_11155111 as ContractArtifact,
  },
  31337: {
    JaccardERC1155: jaccardErc1155_31337 as ContractArtifact,
    JaccardSwap: jaccardSwap_31337 as ContractArtifact,
    Essence: essence_31337 as ContractArtifact,
    Scrip: scrip_31337 as ContractArtifact,
    UniswapV2Factory: uniswapV2Factory_31337 as ContractArtifact,
    UniswapV2Router02: uniswapV2Router02_31337 as ContractArtifact,
    ScripEssencePair: scripEssencePair_31337 as ContractArtifact,
    Badges: badges_31337 as ContractArtifact,
  },
};

export function getContract(chainId: number, name: ContractName): ContractArtifact | null {
  return REGISTRY[chainId]?.[name] ?? null;
}
