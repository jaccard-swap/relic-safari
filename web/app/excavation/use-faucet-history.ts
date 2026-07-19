import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

export interface Erc20ClaimRecord {
  id: string;
  amount: string;
  txHash: string;
  chainId: number;
  createdAt: string;
}

export function useFaucetHistory(limit = 5) {
  const { address, chainId } = useAccount();
  return useQuery({
    queryKey: ["faucet-history", address, chainId, limit],
    queryFn: () =>
      apiJson<{ history: Erc20ClaimRecord[] }>(`/faucet/erc20/history?address=${address}&chainId=${chainId}&limit=${limit}`).then(
        (d) => d.history,
      ),
    enabled: !!address && !!chainId,
  });
}

export function useRecordClaim() {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  return useMutation({
    mutationFn: async ({ txHash, amount }: { txHash: string; amount: string }) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson("/faucet/erc20/record", {
        method: "POST",
        body: JSON.stringify({ recipient: address, chainId, amount, txHash }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["faucet-history"] });
    },
  });
}
