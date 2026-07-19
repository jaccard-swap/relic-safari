import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";
import { useInvalidateNfts } from "../lib/use-nfts";
import { useBalances } from "../lib/use-balances";

interface Erc1155FaucetResult {
  success: boolean;
  tokenId?: string;
  hash?: string;
  chainId?: number;
  metadata?: Record<string, string | number>;
}

// Server-mediated: the API mints and waits for confirmation before
// responding, so the client never touches the chain directly here.
export function useErc1155Faucet() {
  const { address, chainId } = useAccount();
  const invalidateNfts = useInvalidateNfts();
  const { refetchBalances } = useBalances();

  return useMutation({
    mutationFn: async () => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson<Erc1155FaucetResult>("/faucet", {
        method: "POST",
        body: JSON.stringify({ recipient: address, chainId }),
      });
    },
    onSuccess: () => {
      invalidateNfts();
      refetchBalances();
    },
  });
}
