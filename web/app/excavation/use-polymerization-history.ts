import { useMutation, useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

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

export interface FuseResult {
  success: boolean;
  requestId: string;
  txHash: string;
  chainId: number;
  targetTokenId: string;
  newMetadata: Record<string, unknown>;
  upgradedTraits: Record<string, { from: string; to: string }>;
  essenceYield: number;
}

// Resolves as soon as the fusion tx is submitted (hash in hand), not once
// it's confirmed - the caller should track requestId via useFuseRoom to
// find out when the fusion actually lands, and invalidate nfts/history from
// there (see api/src/routes/faucet/index.ts's POST /polymerase split).
export function useFuse() {
  const { address, chainId } = useAccount();

  return useMutation({
    mutationFn: async ({ targetTokenId, consumedTokenId }: FuseParams) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson<FuseResult>("/faucet/polymerase", {
        method: "POST",
        body: JSON.stringify({ owner: address, targetTokenId, consumedTokenId, chainId }),
      });
    },
  });
}
