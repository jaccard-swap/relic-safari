import { useParams } from "react-router";
import { useAuctionRoom } from "../lib/use-auction-room";
import { useCheckStandingBids } from "../lib/use-check-standing-bids";
import { useSession } from "../auth/use-auth";
import { ActionPanel } from "./action-panel";
import { ActivityFeed } from "./activity-feed";
import { ArtifactPanel } from "./artifact-panel";
import { AuctionHeader } from "./auction-header";

export function AuctionRoomPage() {
  const { auctionId } = useParams();
  const { data: session } = useSession();
  const { auction, nft, highestBid, events, isLoading, error, connected, connectionLost, participantCount, sendChat } = useAuctionRoom(auctionId ?? "");

  useCheckStandingBids(auctionId ?? "", connected);

  if (!auctionId) {
    return <div className="text-center text-sm text-stone-400">No auction specified</div>;
  }

  if (isLoading) {
    return <div className="rounded bg-stone-800/30 p-4 text-center text-[13px] text-stone-400">Loading auction…</div>;
  }

  if (error || !auction) {
    return <div className="rounded bg-red-900/20 p-4 text-center text-[13px] text-red-400">Auction not found</div>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(260px,380px)_1fr] md:items-start">
      {nft && <ArtifactPanel nft={nft} />}

      <div className="min-w-0 space-y-3">
        <AuctionHeader auction={auction} highestBid={highestBid} connected={connected} connectionLost={connectionLost} participantCount={participantCount} />
        <ActionPanel auction={auction} nft={nft} highestBid={highestBid} />
        <ActivityFeed events={events} onSendChat={sendChat} canChat={!!session?.authenticated} />
      </div>
    </div>
  );
}
