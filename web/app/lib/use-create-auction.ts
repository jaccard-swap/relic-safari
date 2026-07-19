import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { apiJson } from "./api";
import type { Auction } from "./auctions";
import { getContract } from "./contracts";
import { randomSalt4, useAuctionSignature } from "./use-auction-signature";
import type { Nft } from "./use-nfts";

export interface CreateAuctionParams {
  nft: Nft;
  title: string;
  description?: string;
  startingBid: string; // decimal SCRIP amount, e.g. "5"
  durationHours: number;
}

interface CreateAuctionResponse {
  auction: Auction;
  attachedBids: number;
}

// Auction creation is signature-only - no on-chain transaction. The
// auctioneer signs a permit authorizing JaccardSwap to move this one NFT
// (bound by tokenId + a random salt, expiring at `deadline`), then signs the
// listing itself (which embeds the permit). Both signatures get posted to
// the API; nothing is spent or transferred until a bid is actually settled.
export function useCreateAuction() {
  const queryClient = useQueryClient();
  const { address, chainId } = useAccount();
  const { signNftPermit, signAuction } = useAuctionSignature(chainId ?? 0);

  return useMutation({
    mutationFn: async (params: CreateAuctionParams): Promise<CreateAuctionResponse> => {
      if (!address || !chainId) throw new Error("Wallet not connected");

      const jaccardErc1155 = getContract(chainId, "JaccardERC1155");
      const jaccardSwap = getContract(chainId, "JaccardSwap");
      const scrip = getContract(chainId, "Scrip");
      if (!jaccardErc1155 || !jaccardSwap || !scrip) {
        throw new Error(`Auctions aren't deployed on chain ${chainId} yet`);
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + params.durationHours * 3600);
      const reservePrice = parseEther(params.startingBid);
      const tokenId = BigInt(params.nft.tokenId);

      const nftPermit = {
        owner: address,
        spender: jaccardSwap.address,
        tokenId,
        amount: 1n,
        deadline,
        salt: randomSalt4(),
      };
      const nftPermitSignature = await signNftPermit(nftPermit);

      const auctionSalt = randomSalt4();
      const signature = await signAuction({
        salt: auctionSalt,
        deadline,
        nft: jaccardErc1155.address,
        token: scrip.address,
        reservePrice,
        nftPermit,
        nftPermitSignature,
      });

      return apiJson<CreateAuctionResponse>("/auction", {
        method: "POST",
        body: JSON.stringify({
          title: params.title,
          description: params.description || undefined,
          nftContract: jaccardErc1155.address,
          nftTokenId: params.nft.tokenId,
          chainId,
          tokenContract: scrip.address,
          startingBid: reservePrice.toString(),
          endTime: Number(deadline),
          auctioneer: address,
          salt: auctionSalt,
          signature,
          nftPermit: {
            owner: nftPermit.owner,
            spender: nftPermit.spender,
            tokenId: nftPermit.tokenId.toString(),
            amount: nftPermit.amount.toString(),
            deadline: nftPermit.deadline.toString(),
            salt: nftPermit.salt,
          },
          nftPermitSignature,
          nftId: params.nft.id,
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nfts"] });
    },
  });
}
