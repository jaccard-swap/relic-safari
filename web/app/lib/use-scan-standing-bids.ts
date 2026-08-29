import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "./api";

export interface ScannedBid {
  id: string;
  bidder: string;
  amount: string;
  matches: number;
}

interface CheckBidsResponse {
  matched: ScannedBid[];
  count?: number;
  checkedAt?: string;
  skipped?: boolean;
  message?: string;
}

export type ScanOutcome = { kind: "matched"; bids: ScannedBid[] } | { kind: "empty" } | { kind: "skipped"; message: string };

// Manual, stateful counterpart to use-check-standing-bids.ts's silent
// fire-and-forget hook - that one stays untouched (any viewer, no feedback),
// this one is for a user who wants to see what a (re)check actually found.
export function useScanStandingBids(auctionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<ScanOutcome> => {
      const res = await apiJson<CheckBidsResponse>(`/auction/${auctionId}/check-bids`, { method: "POST" });
      if (res.skipped) return { kind: "skipped", message: res.message ?? "Recently checked, try again later" };
      return res.matched.length > 0 ? { kind: "matched", bids: res.matched } : { kind: "empty" };
    },
    onSuccess: (outcome) => {
      // Backstop in case the websocket broadcast from placeBid hasn't landed
      // yet when this mutation resolves.
      if (outcome.kind === "matched") {
        void queryClient.invalidateQueries({ queryKey: ["auction", auctionId] });
      }
    },
  });
}
