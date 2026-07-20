import { MINHASH_BANDS } from "@shared/constants";
import { formatEther } from "viem";
import { TRAIT_KEY_EMOJI } from "../lib/artifact-styles";
import type { StandingBid } from "../lib/standing-bids";

interface StandingBidCardProps {
  bid: StandingBid;
  onCancel: () => void;
  isCancelling?: boolean;
}

export function StandingBidCard({ bid, onCancel, isCancelling }: StandingBidCardProps) {
  const amount = parseFloat(formatEther(BigInt(bid.amount))).toFixed(1);

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-stone-700/50 bg-stone-800/40 p-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(bid.desiredTraits).map(([key, value]) => (
            <span key={key} className="text-[11px] text-stone-400">
              {TRAIT_KEY_EMOJI[key]} {value}
            </span>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-stone-500">
          {bid.minMatches}/{MINHASH_BANDS} bands · {amount} SCRIP
        </div>
      </div>
      <button type="button" onClick={onCancel} disabled={isCancelling} className="shrink-0 text-xs text-stone-500 hover:text-red-400 disabled:opacity-50">
        ✕
      </button>
    </div>
  );
}
