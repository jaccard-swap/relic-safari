import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { computeMinHash, MINHASH_BANDS } from "@shared/constants";
import { parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { apiJson } from "./api";
import { getContract } from "./contracts";
import { asMinHashTuple, randomSalt4, useAuctionSignature } from "./use-auction-signature";

export interface StandingBid {
  id: string;
  bidder: string;
  chainId: number;
  amount: string;
  targetMinHash: string[];
  minMatches: number;
  desiredTraits: Record<string, string>;
  status: "active" | "matched" | "expired" | "cancelled" | string;
  matchedAuctionId?: string | null;
  deadline: string;
  createdAt: string;
}

export function useStandingBids() {
  const { address, chainId } = useAccount();
  return useQuery({
    queryKey: ["standingBids", address, chainId],
    queryFn: () => {
      const params = new URLSearchParams({ bidder: address!, status: "active" });
      if (chainId) params.set("chainId", String(chainId));
      return apiJson<{ bids: StandingBid[] }>(`/bids?${params}`).then((r) => r.bids);
    },
    enabled: !!address,
  });
}

export function useCancelStandingBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/bids/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["standingBids"] });
    },
  });
}

export interface CreateStandingBidParams {
  amount: string; // decimal SCRIP
  desiredTraits: Record<string, string>;
  minMatches: number;
}

// A standing buy order: a trait-based limit bid, signed once and matched
// against every new auction server-side (see api's attachStandingBids) - not
// tied to a specific NFT. Same signature-only shape as auction creation: an
// ERC20 permit for payment plus a Bid signed over the MinHash computed from
// the chosen traits, good until `deadline` (7 days).
export function useCreateStandingBid() {
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
    mutationFn: async (params: CreateStandingBidParams) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      const jaccardSwap = getContract(chainId, "JaccardSwap");
      if (!jaccardSwap || !scrip) throw new Error(`Standing buy orders aren't available on chain ${chainId} yet`);
      if (nonce === undefined) throw new Error("Loading account nonce - try again in a moment");
      if (Object.keys(params.desiredTraits).length === 0) throw new Error("Select at least one trait");

      const targetMinHash = asMinHashTuple(computeMinHash(params.desiredTraits));
      const value = parseEther(params.amount);
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);

      const { v, r, s } = await signErc20Permit({ owner: address, spender: jaccardSwap.address, value, nonce: nonce as bigint, deadline });

      const salt = randomSalt4();
      const signature = await signBid({
        salt,
        deadline,
        targetMinHash,
        minMatches: params.minMatches,
        permit: { owner: address, spender: jaccardSwap.address, value, deadline },
      });

      return apiJson("/bids", {
        method: "POST",
        body: JSON.stringify({
          bidder: address,
          chainId,
          amount: value.toString(),
          targetMinHash,
          minMatches: params.minMatches,
          desiredTraits: params.desiredTraits,
          salt,
          deadline: Number(deadline),
          signature,
          erc20Permit: { owner: address, spender: jaccardSwap.address, value: value.toString(), deadline: deadline.toString(), v, r, s },
        }),
      });
    },
    onSuccess: () => {
      void refetchNonce();
      void queryClient.invalidateQueries({ queryKey: ["standingBids"] });
    },
  });
}

export { MINHASH_BANDS };
