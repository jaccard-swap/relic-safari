import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { apiJson } from "./api";
import { getContract } from "./contracts";
import { asMinHashTuple } from "./use-auction-signature";
import { notifyTransaction, resolveTransaction } from "./transaction-toasts";
import { wagmiConfig } from "./wagmi";

type Status = "idle" | "loading" | "confirming" | "recording" | "error";

export interface ConsumeResult {
  txHash: `0x${string}`;
  winner: `0x${string}`;
  winningBid: string;
}

interface ConsumeApiBid {
  salt: string;
  deadline: string; // ISO
  targetMinHash: string[];
  minMatches: number;
  signature: `0x${string}`;
  erc20Permit: { owner: string; spender: string; value: string; deadline: string; v: number; r: string; s: string };
}

interface ConsumeApiResponse {
  auction: {
    salt: string;
    endTime: string;
    nftContract: `0x${string}`;
    tokenContract: `0x${string}`;
    startingBid: string;
    signature: `0x${string}`;
    nftPermit: { owner: string; spender: string; tokenId: string; amount: string; deadline: string; salt: string };
    nftPermitSignature: `0x${string}`;
  };
  bids: ConsumeApiBid[];
  nft: { id: string } | null;
}

// Settlement reuses the auctioneer's ORIGINAL listing signature (captured at
// creation time) rather than asking them to sign again - the deployed
// AUCTION_TYPEHASH only covers salt/deadline/nft/token/reservePrice/nftPermit,
// not the bids array, so a fresh signature over the same fields would be
// byte-for-byte identical anyway. The old app re-signed on every settle
// attempt for no functional benefit (and an extra, needless wallet prompt).
export function useConsumeAuction(auctionId: string) {
  const { address, chainId } = useAccount();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function consume(): Promise<ConsumeResult | null> {
    setStatus("loading");
    setError(null);
    let toastId: string | null = null;
    try {
      if (!address || !chainId) throw new Error("Wallet not connected");
      const jaccardSwap = getContract(chainId, "JaccardSwap");
      if (!jaccardSwap) throw new Error(`Auctions aren't deployed on chain ${chainId} yet`);

      const { auction, bids, nft } = await apiJson<ConsumeApiResponse>(`/auction/${auctionId}/consume?auctioneer=${address}`);
      if (!bids || bids.length === 0) throw new Error("No bids to settle");
      if (!auction.signature || !auction.nftPermit || !auction.nftPermitSignature) throw new Error("Auction listing is missing its signature");

      // The API's bid ordering is a lexicographic (text) sort, not numeric -
      // the contract hard-reverts unless bids are truly highest-to-lowest,
      // so re-sort numerically here rather than trust that ordering.
      const sortedBids = [...bids].sort((a, b) => {
        const av = BigInt(a.erc20Permit.value);
        const bv = BigInt(b.erc20Permit.value);
        return av === bv ? 0 : av > bv ? -1 : 1;
      });

      const nftPermit = {
        owner: auction.nftPermit.owner as `0x${string}`,
        spender: auction.nftPermit.spender as `0x${string}`,
        tokenId: BigInt(auction.nftPermit.tokenId),
        amount: BigInt(auction.nftPermit.amount),
        deadline: BigInt(auction.nftPermit.deadline),
        salt: auction.nftPermit.salt as `0x${string}`,
      };

      const auctionStruct = {
        salt: auction.salt as `0x${string}`,
        deadline: BigInt(Math.floor(new Date(auction.endTime).getTime() / 1000)),
        nft: auction.nftContract,
        token: auction.tokenContract,
        reservePrice: BigInt(auction.startingBid),
        nftPermit,
        nftPermitSignature: auction.nftPermitSignature,
        bids: sortedBids.map((bid) => ({
          salt: bid.salt as `0x${string}`,
          deadline: BigInt(Math.floor(new Date(bid.deadline).getTime() / 1000)),
          targetMinHash: asMinHashTuple(bid.targetMinHash as `0x${string}`[]),
          minMatches: bid.minMatches,
          permit: {
            owner: bid.erc20Permit.owner as `0x${string}`,
            spender: bid.erc20Permit.spender as `0x${string}`,
            value: BigInt(bid.erc20Permit.value),
            deadline: BigInt(bid.erc20Permit.deadline),
            v: bid.erc20Permit.v,
            r: bid.erc20Permit.r as `0x${string}`,
            s: bid.erc20Permit.s as `0x${string}`,
          },
        })),
        bidSignatures: sortedBids.map((bid) => bid.signature),
      };

      const hash = await writeContract(wagmiConfig, {
        address: jaccardSwap.address,
        abi: jaccardSwap.abi,
        functionName: "consumeAuction",
        args: [auctionStruct, auction.signature],
        chainId: chainId as 11155111 | 31337,
      });

      toastId = notifyTransaction({ chainId, hash, label: "Settle auction" });
      setStatus("confirming");
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: chainId as 11155111 | 31337 });
      if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
      resolveTransaction(toastId, "success");

      // Read the real winner/amount off the emitted event rather than
      // assuming the top-ranked bid is who actually won - the contract
      // skips any bid that fails its own permit/allowance/expiry check and
      // falls through to the next-highest, so the winner isn't necessarily
      // bids[0].
      const [settledLog] = parseEventLogs({ abi: jaccardSwap.abi, eventName: "AuctionSettled", logs: receipt.logs });
      if (!settledLog) throw new Error("Settlement succeeded on-chain but no AuctionSettled event was found");
      const { winner, amount } = settledLog.args as { winner: `0x${string}`; amount: bigint };

      setStatus("recording");
      await apiJson(`/auction/${auctionId}/settle`, {
        method: "POST",
        body: JSON.stringify({ auctioneer: address, txHash: hash, winner, winningBid: amount.toString() }),
      });
      if (nft?.id) {
        await apiJson("/nft/sync-ownership", {
          method: "POST",
          body: JSON.stringify({ nftId: nft.id, newOwner: winner, chainId }),
        }).catch(() => {
          // Best-effort - ownership will still resolve on next indexer pass.
        });
      }

      void queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
      void queryClient.invalidateQueries({ queryKey: ["nfts"] });

      setStatus("idle");
      return { txHash: hash, winner, winningBid: amount.toString() };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Settlement failed";
      if (toastId) resolveTransaction(toastId, "error", message);
      setStatus("error");
      setError(message);
      return null;
    }
  }

  return { consume, status, error };
}
