import { useEffect, useState } from "react";
import { Link } from "react-router";
import { formatEther } from "viem";
import { formatTimeLeft, type Auction } from "../lib/auctions";

interface AuctionCardProps {
  auction: Auction;
}

export function AuctionCard({ auction }: AuctionCardProps) {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(auction.endTime));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(formatTimeLeft(auction.endTime)), 1000);
    return () => clearInterval(timer);
  }, [auction.endTime]);

  const startingBid = parseFloat(formatEther(BigInt(auction.startingBid))).toFixed(1);

  return (
    <Link to={`/auction/${auction.id}`} className="block rounded border border-amber-900/30 bg-stone-800/40 p-2 transition-colors hover:border-amber-700/50">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] text-amber-200">{auction.title}</span>
        <span className={`shrink-0 text-[11px] ${timeLeft === "Ended" ? "text-stone-500" : "text-amber-400/80"}`}>{timeLeft}</span>
      </div>
      <div className="mt-1 text-xs text-stone-400">Starting bid: {startingBid} SCRIP</div>
    </Link>
  );
}
