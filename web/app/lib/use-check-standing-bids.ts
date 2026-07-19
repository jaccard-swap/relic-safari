import { useEffect } from "react";
import { apiJson } from "./api";

// Standing bids only auto-attach at auction-creation time; one created after
// an auction is already live needs a manual re-match. The auction room
// proactively triggers one shortly after connecting (server-side debounced
// to once per 30s, so this is cheap to fire on every room visit).
export function useCheckStandingBids(auctionId: string, connected: boolean) {
  useEffect(() => {
    if (!connected || !auctionId) return;
    const timer = setTimeout(() => {
      apiJson(`/auction/${auctionId}/check-bids`, { method: "POST" }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [auctionId, connected]);
}
