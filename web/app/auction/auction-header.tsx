import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { formatTimeLeft, type Auction } from "../lib/auctions";
import type { Nft } from "../lib/use-nfts";

interface AuctionHeaderProps {
  auction: Auction;
  nft: Nft | null;
  highestBid: string | null;
  connected: boolean;
  connectionLost: boolean;
  participantCount: number;
}

export function AuctionHeader({ auction, nft, highestBid, connected, connectionLost, participantCount }: AuctionHeaderProps) {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(auction.endTime));

  useEffect(() => {
    if (auction.status !== "active") return;
    const timer = setInterval(() => setTimeLeft(formatTimeLeft(auction.endTime)), 1000);
    return () => clearInterval(timer);
  }, [auction.endTime, auction.status]);

  const ended = auction.status !== "active" || timeLeft === "Ended";
  const displayBid = highestBid ?? auction.startingBid;

  return (
    <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-amber-200">{auction.title}</h1>
          {auction.description && <p className="mt-0.5 text-[10px] text-stone-400">{auction.description}</p>}
        </div>
        <div
          className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-medium ${
            connected ? "bg-emerald-900/40 text-emerald-300" : connectionLost ? "bg-red-900/40 text-red-300" : "bg-stone-700/50 text-stone-400"
          }`}
        >
          {connected ? `● ${participantCount} live` : connectionLost ? "Disconnected" : "Connecting…"}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <div className="text-[9px] text-stone-500">{auction.status === "settled" ? "Settled for" : "Current bid"}</div>
          <div className="font-mono text-lg text-amber-200">
            {parseFloat(formatEther(BigInt(displayBid))).toFixed(2)} <span className="text-xs text-stone-500">SCRIP</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-stone-500">{auction.status === "active" ? "Time left" : "Status"}</div>
          <div className={`text-sm font-medium ${ended ? "text-stone-400" : "text-amber-300"}`}>
            {auction.status === "settled" ? "🏆 Settled" : auction.status === "cancelled" ? "Cancelled" : timeLeft}
          </div>
        </div>
      </div>

      {nft && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-stone-700/50 pt-2 text-[9px] text-stone-400">
          <span>Artifact:</span>
          <span className="text-amber-300">{nft.metadata.name || `#${nft.tokenId.slice(-6)}`}</span>
        </div>
      )}
    </div>
  );
}
