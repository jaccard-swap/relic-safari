import { useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { getExplorerTxUrl } from "../lib/explorer";
import { formatTimeLeft, type Auction } from "../lib/auctions";
import { useConsumeAuction } from "../lib/use-consume-auction";
import { useCreateBid } from "../lib/use-create-bid";
import type { Nft } from "../lib/use-nfts";

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface ActionPanelProps {
  auction: Auction;
  nft: Nft | null;
  highestBid: string | null;
}

export function ActionPanel({ auction, nft, highestBid }: ActionPanelProps) {
  const { address, isConnected } = useAccount();
  const createBid = useCreateBid(auction.id, auction.endTime);
  const { consume, status: consumeStatus, error: consumeError } = useConsumeAuction(auction.id);

  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState<string | null>(null);

  const isAuctioneer = !!address && address.toLowerCase() === auction.auctioneer.toLowerCase();
  const ended = auction.status !== "active" || formatTimeLeft(auction.endTime) === "Ended";
  const minBid = highestBid ? BigInt(highestBid) + 1n : BigInt(auction.startingBid);

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    setBidError(null);
    if (!nft) {
      setBidError("Artifact data not loaded yet");
      return;
    }
    try {
      await createBid.mutateAsync({ amount: bidAmount, nftMinHash: nft.minHash as `0x${string}`[] });
      setBidAmount("");
    } catch (err) {
      setBidError(err instanceof Error ? err.message : "Failed to place bid");
    }
  }

  if (auction.status === "settled") {
    const explorerUrl = auction.settlementTxHash ? getExplorerTxUrl(auction.chainId, auction.settlementTxHash) : null;
    return (
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-900/20 p-4 text-center">
        <div className="text-sm font-semibold text-emerald-300">🎉 Auction Settled</div>
        {auction.winner && (
          <div className="mt-1.5 text-[13px] text-stone-300">
            Won by {short(auction.winner)} for {auction.winningBid ? parseFloat(formatEther(BigInt(auction.winningBid))).toFixed(2) : "?"} SCRIP
          </div>
        )}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-xs text-amber-400/80 underline hover:text-amber-300">
            View transaction
          </a>
        )}
      </div>
    );
  }

  if (auction.status === "cancelled") {
    return <div className="rounded-lg border border-stone-700/50 bg-stone-800/30 p-4 text-center text-[13px] text-stone-400">Auction cancelled</div>;
  }

  if (isAuctioneer) {
    if (!highestBid) {
      return (
        <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4 text-center text-[13px] text-stone-400">
          Waiting for a bid — you can settle as soon as one comes in
        </div>
      );
    }
    const busy = consumeStatus === "loading" || consumeStatus === "confirming" || consumeStatus === "recording";
    return (
      <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4">
        {!ended && (
          <p className="mb-2 text-[11px] text-stone-500">
            Ends the auction now and accepts the current highest bid ({parseFloat(formatEther(BigInt(highestBid))).toFixed(2)} SCRIP).
          </p>
        )}
        <button
          type="button"
          onClick={() => void consume()}
          disabled={busy}
          className="w-full rounded bg-gradient-to-r from-amber-600 to-yellow-700 py-3 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {consumeStatus === "loading"
            ? "Preparing…"
            : consumeStatus === "confirming"
              ? "Confirming…"
              : consumeStatus === "recording"
                ? "Recording…"
                : ended
                  ? "🏆 Settle & Transfer"
                  : "🏆 End Auction Now"}
        </button>
        {consumeError && <p className="mt-1.5 text-xs text-red-400">{consumeError}</p>}
      </div>
    );
  }

  if (ended) {
    return <div className="rounded-lg border border-stone-700/50 bg-stone-800/30 p-4 text-center text-[13px] text-stone-400">Auction ended — waiting for the auctioneer to settle</div>;
  }

  return (
    <form onSubmit={handleBid} className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4">
      <label className="mb-1.5 block text-xs text-stone-400">Your bid (min {parseFloat(formatEther(minBid)).toFixed(2)} SCRIP)</label>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          placeholder={parseFloat(formatEther(minBid)).toFixed(2)}
          disabled={!isConnected}
          className="flex-1 rounded border border-stone-700 bg-stone-900 px-3 py-2 text-xs text-stone-200 focus:border-amber-600 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isConnected || createBid.isPending || !bidAmount}
          className="rounded bg-gradient-to-r from-amber-600 to-yellow-700 px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
        >
          {createBid.isPending ? "Signing…" : "Bid"}
        </button>
      </div>
      {!isConnected && <p className="mt-1.5 text-xs text-stone-500">Connect a wallet to bid</p>}
      {bidError && <p className="mt-1.5 text-xs text-red-400">{bidError}</p>}
    </form>
  );
}
