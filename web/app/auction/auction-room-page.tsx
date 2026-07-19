import { useParams } from "react-router";
import { NftDetailModal } from "../components/nft-detail-modal";
import { useAuctionRoom } from "../lib/use-auction-room";
import { useCheckStandingBids } from "../lib/use-check-standing-bids";
import { useSession } from "../auth/use-auth";
import { ActionPanel } from "./action-panel";
import { ActivityFeed } from "./activity-feed";
import { AuctionHeader } from "./auction-header";
import { useState } from "react";

export function AuctionRoomPage() {
  const { auctionId } = useParams();
  const { data: session } = useSession();
  const { auction, nft, highestBid, events, isLoading, error, connected, connectionLost, participantCount, sendChat } = useAuctionRoom(auctionId ?? "");
  const [showNftDetail, setShowNftDetail] = useState(false);

  useCheckStandingBids(auctionId ?? "", connected);

  if (!auctionId) {
    return <div className="text-center text-sm text-stone-400">No auction specified</div>;
  }

  if (isLoading) {
    return <div className="rounded bg-stone-800/30 p-3 text-center text-[10px] text-stone-400">Loading auction…</div>;
  }

  if (error || !auction) {
    return <div className="rounded bg-red-900/20 p-3 text-center text-[10px] text-red-400">Auction not found</div>;
  }

  return (
    <div className="space-y-2">
      <AuctionHeader auction={auction} nft={nft} highestBid={highestBid} connected={connected} connectionLost={connectionLost} participantCount={participantCount} />

      {nft && (
        <button type="button" onClick={() => setShowNftDetail(true)} className="w-full rounded border border-stone-700/50 bg-stone-800/30 p-1.5 text-left text-[9px] text-stone-400 hover:border-amber-700/50">
          View artifact details →
        </button>
      )}

      <ActionPanel auction={auction} nft={nft} highestBid={highestBid} />

      <ActivityFeed events={events} onSendChat={sendChat} canChat={!!session?.authenticated} />

      <NftDetailModal nft={showNftDetail ? nft : null} onClose={() => setShowNftDetail(false)} />
    </div>
  );
}
