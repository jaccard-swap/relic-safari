import { useQuery } from "@tanstack/react-query";
import { apiJson } from "../lib/api";

export interface ForgeTraitPreview {
  current: string;
  upgradeable: boolean;
  next: { value: string; cost: number } | null;
}

export interface ForgeSimulation {
  nftId: string;
  tokenId: string;
  traits: Record<string, ForgeTraitPreview>;
  overflow: { currentLevel: number; cost: number } | null;
}

export function useForgeSimulation(nftId: string | null) {
  return useQuery({
    queryKey: ["forge-simulation", nftId],
    queryFn: () => apiJson<ForgeSimulation>(`/forge/simulate?nftId=${nftId}`),
    enabled: !!nftId,
  });
}
