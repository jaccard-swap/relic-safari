import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { formatTimeLeft, type Auction } from "../lib/auctions";
import { TradingCard } from "../excavation/trading-card";

interface AuctionTradingCardProps {
  auction: Auction;
}

// Grid-mode sibling of AuctionCard - same click-through-to-room and live
// countdown, laid out as a TradingCard so Bazaar matches the Vault/Excavation
// card treatment.
export function AuctionTradingCard({ auction }: AuctionTradingCardProps) {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(auction.endTime));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(formatTimeLeft(auction.endTime)), 1000);
    return () => clearInterval(timer);
  }, [auction.endTime]);

  const handleClick = () => navigate(`/auction/${auction.id}`);
  const timeStyles = timeLeft === "Ended" ? "text-stone-400" : "text-amber-300";

  if (!auction.nft) {
    // No linked nft to render as a trading card (shouldn't normally happen -
    // auctions are always created from a Vault artifact) - fall back to a
    // plain tile with the same info the list row shows instead of nothing.
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex w-32 shrink-0 flex-col justify-between gap-1.5 rounded-lg border border-amber-900/30 bg-stone-800/40 p-2 text-left transition-colors hover:border-amber-700/50"
      >
        <span className="truncate text-xs text-amber-200">{auction.title}</span>
        <span className={`text-[11px] ${timeStyles}`}>{timeLeft}</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <TradingCard nft={auction.nft} onClick={handleClick} />
      <span className={`absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium ${timeStyles}`}>{timeLeft}</span>
    </div>
  );
}
