import { useState } from "react";
import { formatEther } from "viem";
import { TRAIT_KEY_EMOJI } from "../lib/artifact-styles";
import { useSubmitMatchFeedback, type StandingBid } from "../lib/standing-bids";

interface MatchedStandingBidCardProps {
  bid: StandingBid;
}

// A standing buy order that got matched to an auction - the buyer's own view
// of the result, with a lightweight reaction to gauge whether MinHash-based
// matching actually found them something they wanted.
export function MatchedStandingBidCard({ bid }: MatchedStandingBidCardProps) {
  const submitFeedback = useSubmitMatchFeedback();
  const [sent, setSent] = useState<"good" | "bad" | null>(null);
  const amount = parseFloat(formatEther(BigInt(bid.amount))).toFixed(1);

  function react(reaction: "good" | "bad") {
    if (!bid.matchedAuctionId || submitFeedback.isPending || sent) return;
    setSent(reaction);
    submitFeedback.mutate({ standingBidId: bid.id, auctionId: bid.matchedAuctionId, reaction });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-emerald-800/40 bg-emerald-900/10 p-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(bid.desiredTraits).map(([key, value]) => (
            <span key={key} className="text-[11px] text-stone-400">
              {TRAIT_KEY_EMOJI[key]} {value}
            </span>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-emerald-400">Matched · {amount} SCRIP</div>
      </div>
      {sent ? (
        <span className="shrink-0 text-[11px] text-stone-500">Thanks!</span>
      ) : (
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => react("good")} title="Good match" className="text-sm hover:opacity-70">
            👍
          </button>
          <button type="button" onClick={() => react("bad")} title="Not what I wanted" className="text-sm hover:opacity-70">
            👎
          </button>
        </div>
      )}
    </div>
  );
}
