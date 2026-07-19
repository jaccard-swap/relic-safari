// Client-side shape of an auction row, as returned by api/src/routes/auction.
// Mirrors shared/database's `auctions` table plus the derived `status` values
// the backend actually writes ('active' | 'settled' | 'cancelled' - 'pending'
// and 'ended' are declared in the schema comment but never written).
export interface Auction {
  id: string;
  title: string;
  description?: string | null;
  nftId?: string | null;
  nftContract: string;
  nftTokenId: string;
  chainId: number;
  tokenContract: string;
  startingBid: string;
  endTime: string;
  auctioneer: string;
  status: "active" | "settled" | "cancelled" | string;
  winner?: string | null;
  winningBid?: string | null;
  settlementTxHash?: string | null;
  createdAt: string;
}

export interface AuctionEvent {
  id: string;
  auctionId: string;
  type: "created" | "bid" | "chat" | "settled" | "cancelled" | string;
  actor: string;
  summary: Record<string, unknown> | null;
  createdAt: string;
}

export interface Bid {
  id: string;
  auctionId: string;
  bidder: string;
  amount: string;
  status: "active" | "outbid" | "winning" | "refunded" | string;
  createdAt: string;
}

export function formatTimeLeft(endTime: string): string {
  const ms = new Date(endTime).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
