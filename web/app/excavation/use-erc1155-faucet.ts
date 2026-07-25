import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

export interface Erc1155FaucetResult {
  success: boolean;
  requestId: string;
  tokenId: string;
  hash: string;
  chainId: number;
  metadata: Record<string, string | number>;
  minHash: string[];
}

// Server-mediated and fast: the API signs and submits the mint, then
// responds as soon as it has a transaction hash - it does not wait for
// confirmation. The caller tracks the rest of the lifecycle via
// useDigRoom(requestId), which is also where the post-confirmation
// nfts/balances invalidation happens (the mint isn't actually done yet at
// this point).
export function useErc1155Faucet() {
  const { address, chainId } = useAccount();

  return useMutation({
    mutationFn: async () => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson<Erc1155FaucetResult>("/faucet", {
        method: "POST",
        body: JSON.stringify({ recipient: address, chainId }),
      });
    },
  });
}
