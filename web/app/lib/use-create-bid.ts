import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MINHASH_BANDS } from "@shared/constants";
import { parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { apiJson } from "./api";
import { getContract } from "./contracts";
import { asMinHashTuple, randomSalt4, useAuctionSignature } from "./use-auction-signature";

export interface CreateBidParams {
  amount: string; // decimal SCRIP
  nftMinHash: readonly `0x${string}`[];
}

// Bidding on a specific auction is a direct, exact-match bid on that NFT
// (minMatches = MINHASH_BANDS against the NFT's own minHash) - distinct from
// a standing buy order's trait-based approximate match. Same signature-only
// shape: no funds move until the auctioneer settles.
export function useCreateBid(auctionId: string) {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  const { signErc20Permit, signBid } = useAuctionSignature(chainId ?? 0);
  const scrip = chainId ? getContract(chainId, "Scrip") : null;

  const { data: nonce, refetch: refetchNonce } = useReadContract({
    address: scrip?.address,
    abi: scrip?.abi,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!scrip },
  });

  return useMutation({
    mutationFn: async (params: CreateBidParams) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      const jaccardSwap = getContract(chainId, "JaccardSwap");
      if (!jaccardSwap || !scrip) throw new Error(`Bidding isn't available on chain ${chainId} yet`);
      if (nonce === undefined) throw new Error("Loading account nonce - try again in a moment");

      const targetMinHash = asMinHashTuple(params.nftMinHash);
      const value = parseEther(params.amount);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const { v, r, s } = await signErc20Permit({ owner: address, spender: jaccardSwap.address, value, nonce: nonce as bigint, deadline });

      const salt = randomSalt4();
      const signature = await signBid({
        salt,
        deadline,
        targetMinHash,
        minMatches: MINHASH_BANDS,
        permit: { owner: address, spender: jaccardSwap.address, value, deadline },
      });

      return apiJson(`/auction/${auctionId}/bid`, {
        method: "POST",
        body: JSON.stringify({
          bidder: address,
          amount: value.toString(),
          salt,
          deadline: Number(deadline),
          targetMinHash,
          minMatches: MINHASH_BANDS,
          erc20Permit: { owner: address, spender: jaccardSwap.address, value: value.toString(), deadline: deadline.toString(), v, r, s },
          signature,
        }),
      });
    },
    onSuccess: () => {
      void refetchNonce();
      void queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
    },
  });
}
