import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";
import { useInvalidateNfts } from "../lib/use-nfts";

export interface PolymerizationRecord {
  id: string;
  targetNftId: string;
  consumedNftId: string;
  upgradedTraits: Record<string, { from: string; to: string }>;
  experienceGained: Record<string, number>;
  essenceYield: number;
  txHash: string | null;
  status: string;
  createdAt: string;
  targetMetadata: Record<string, unknown> & { name?: string; rarity?: string; form?: string };
  targetTokenId: string | null;
}

export function usePolymerizationHistory(limit = 5) {
  const { address, chainId } = useAccount();
  return useQuery({
    queryKey: ["polymerization-history", address, chainId, limit],
    queryFn: () =>
      apiJson<{ history: PolymerizationRecord[] }>(`/faucet/polymerase/history?address=${address}&chainId=${chainId}&limit=${limit}`).then(
        (d) => d.history,
      ),
    enabled: !!address && !!chainId,
  });
}

interface FuseParams {
  targetTokenId: string;
  consumedTokenId: string;
}

interface FuseResult {
  success: boolean;
  txHash: string;
  targetTokenId: string;
  newMetadata: Record<string, unknown>;
  upgradedTraits: Record<string, { from: string; to: string }>;
  essenceYield: number;
}

export function useFuse() {
  const { address, chainId } = useAccount();
  const queryClient = useQueryClient();
  const invalidateNfts = useInvalidateNfts();

  return useMutation({
    mutationFn: async ({ targetTokenId, consumedTokenId }: FuseParams) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson<FuseResult>("/faucet/polymerase", {
        method: "POST",
        body: JSON.stringify({ owner: address, targetTokenId, consumedTokenId, chainId }),
      });
    },
    onSuccess: () => {
      invalidateNfts();
      void queryClient.invalidateQueries({ queryKey: ["polymerization-history"] });
    },
  });
}
