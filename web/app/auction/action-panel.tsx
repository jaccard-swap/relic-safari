import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useAuthGate } from "../auth/use-auth-gate";
import { getExplorerTxUrl } from "../lib/explorer";
import { formatTimeLeft, type Auction } from "../lib/auctions";
import { useConsumeAuction } from "../lib/use-consume-auction";
import { useCreateBid } from "../lib/use-create-bid";
import { ConsumeModal } from "./consume-modal";
import { StandingBidScan } from "./standing-bid-scan";
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
  const authenticated = useAuthGate();
  const createBid = useCreateBid(auction.id, auction.endTime);
  const { consume, status: consumeStatus, error: consumeError, hash: consumeHash, result: consumeResult } = useConsumeAuction(auction.id);
  const [consumeModalOpen, setConsumeModalOpen] = useState(false);

  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState<string | null>(null);

  const isAuctioneer = !!address && address.toLowerCase() === auction.auctioneer.toLowerCase();
  const ended = auction.status !== "active" || formatTimeLeft(auction.endTime) === "Ended";
  const minBid = highestBid ? BigInt(highestBid) + 1n : BigInt(auction.startingBid);

  // Auctioneer gets the play-by-play in ConsumeModal, but anyone else on the
  // page (a bidder, a spectator) only ever sees `auction.status` flip via
  // useAuctionRoom's websocket-triggered refetch - give that "watcher" case
  // its own one-shot reveal too, gated to an actual live transition so a
  // page load/reload onto an already-settled auction stays static.
  const prevStatusRef = useRef(auction.status);
  const [justSettled, setJustSettled] = useState(false);
  useEffect(() => {
    if (prevStatusRef.current !== "settled" && auction.status === "settled") {
      setJustSettled(true);
    }
    prevStatusRef.current = auction.status;
  }, [auction.status]);

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    setBidError(null);
    if (!nft) {
      setBidError("Artifact data not loaded yet");
      return;
    }
    if (!authenticated) {
      setBidError("Sign in to bid");
      return;
    }
    try {
      await createBid.mutateAsync({ amount: bidAmount, nftMinHash: nft.minHash as `0x${string}`[] });
      setBidAmount("");
    } catch (err) {
      setBidError(err instanceof Error ? err.message : "Failed to place bid");
    }
  }

  const [settleAuthError, setSettleAuthError] = useState(false);

  function handleConsume() {
    if (!authenticated) {
      setSettleAuthError(true);
      return;
    }
    setSettleAuthError(false);
    setConsumeModalOpen(true);
    void consume();
  }

  let content: React.ReactNode;

  if (auction.status === "settled") {
    const explorerUrl = auction.settlementTxHash ? getExplorerTxUrl(auction.chainId, auction.settlementTxHash) : null;
    // The auctioneer already watched this reveal play out in ConsumeModal -
    // only animate here for everyone else's first live look at the result.
    const animate = justSettled && !isAuctioneer;
    content = (
      <div className={`relative overflow-hidden rounded-lg border border-emerald-800/50 bg-emerald-900/20 p-4 text-center ${animate ? "[animation:treasure-reveal_0.6s_ease-out]" : ""}`}>
        {animate && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full bg-emerald-400/30 blur-xl [animation:treasure-glow_1s_ease-out]" />
          </div>
        )}
        <div className="relative text-sm font-semibold text-emerald-300">🎉 Auction Settled</div>
        {auction.winner && (
          <div className="relative mt-1.5 text-[13px] text-stone-300">
            Won by {short(auction.winner)} for {auction.winningBid ? parseFloat(formatEther(BigInt(auction.winningBid))).toFixed(2) : "?"} SCRIP
          </div>
        )}
        {explorerUrl && (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="relative mt-1.5 inline-block text-xs text-amber-400/80 underline hover:text-amber-300">
            View transaction
          </a>
        )}
      </div>
    );
  } else if (auction.status === "cancelled") {
    content = <div className="rounded-lg border border-stone-700/50 bg-stone-800/30 p-4 text-center text-[13px] text-stone-400">Auction cancelled</div>;
  } else if (isAuctioneer) {
    if (!highestBid) {
      content = (
        <div className="space-y-2">
          <StandingBidScan auctionId={auction.id} />
          <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4 text-center text-[13px] text-stone-400">
            Waiting for a bid — you can settle as soon as one comes in
          </div>
        </div>
      );
    } else {
      const busy = consumeStatus === "loading" || consumeStatus === "confirming" || consumeStatus === "recording";
      content = (
        <div className="space-y-2">
          <StandingBidScan auctionId={auction.id} />
          <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-4">
            {!ended && (
              <p className="mb-2 text-[11px] text-stone-500">
                Ends the auction now and accepts the current highest bid ({parseFloat(formatEther(BigInt(highestBid))).toFixed(2)} SCRIP).
              </p>
            )}
            <button
              type="button"
              onClick={handleConsume}
              disabled={authenticated && busy}
              title={!authenticated ? "Sign in to settle" : undefined}
              className={`w-full rounded py-3 text-xs font-semibold transition-opacity disabled:opacity-50 ${
                authenticated ? "bg-gradient-to-r from-amber-600 to-yellow-700 text-white" : "bg-stone-800 text-stone-500 opacity-60 hover:opacity-80"
              }`}
            >
              {busy ? "Settling…" : !authenticated ? "🔒 Sign in to settle" : ended ? "🏆 Settle & Transfer" : "🏆 End Auction Now"}
            </button>
            {settleAuthError && <p className="mt-1.5 text-xs text-red-400">Sign in to settle</p>}
            {consumeError && consumeStatus === "error" && !consumeModalOpen && <p className="mt-1.5 text-xs text-red-400">{consumeError}</p>}
          </div>
        </div>
      );
    }
  } else if (ended) {
    content = <div className="rounded-lg border border-stone-700/50 bg-stone-800/30 p-4 text-center text-[13px] text-stone-400">Auction ended — waiting for the auctioneer to settle</div>;
  } else {
    content = (
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
            disabled={!isConnected || (authenticated && (createBid.isPending || !bidAmount))}
            title={isConnected && !authenticated ? "Sign in to bid" : undefined}
            className={`rounded px-4 py-2 text-xs font-semibold transition-opacity disabled:opacity-50 ${
              !isConnected || authenticated ? "bg-gradient-to-r from-amber-600 to-yellow-700 text-white" : "bg-stone-800 text-stone-500 opacity-60 hover:opacity-80"
            }`}
          >
            {createBid.isPending ? "Signing…" : isConnected && !authenticated ? "🔒 Sign in" : "Bid"}
          </button>
        </div>
        {!isConnected && <p className="mt-1.5 text-xs text-stone-500">Connect a wallet to bid</p>}
        {bidError && <p className="mt-1.5 text-xs text-red-400">{bidError}</p>}
      </form>
    );
  }

  return (
    <>
      {content}
      {/* Rendered unconditionally (open=false hides it) rather than only
          inside the isAuctioneer branch above - once consume() succeeds,
          auction.status flips to "settled" and content re-renders into the
          settled branch on the very next tick, which would otherwise unmount
          this modal mid-reveal before the user gets to see it or click
          "Nice!". */}
      <ConsumeModal
        open={consumeModalOpen}
        onClose={() => setConsumeModalOpen(false)}
        chainId={auction.chainId}
        hash={consumeHash}
        status={consumeStatus}
        result={consumeResult}
        error={consumeError}
      />
    </>
  );
}
