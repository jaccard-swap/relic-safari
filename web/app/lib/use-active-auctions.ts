import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WS_MSG } from "@shared/constants";
import { useAccount } from "wagmi";
import { apiJson, apiWebSocketUrl } from "./api";
import type { Auction } from "./auctions";

function queryKey(chainId: number | undefined) {
  return ["auctions", "active", chainId] as const;
}

// React Query stays the single source of truth for the list (unlike the old
// app's separate refetch()-vs-websocket-state); the socket just pushes fresh
// data into the same cache entry the initial REST fetch populated, so a
// client that never gets a working socket connection still has a correct,
// if non-live, list.
export function useActiveAuctions() {
  const { chainId } = useAccount();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(chainId),
    queryFn: () => {
      const params = new URLSearchParams({ status: "active" });
      if (chainId) params.set("chainId", String(chainId));
      return apiJson<{ auctions: Auction[] }>(`/auction?${params}`).then((r) => r.auctions);
    },
  });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;

    function connect() {
      ws = new WebSocket(apiWebSocketUrl("/auction/feed"));

      ws.onopen = () => {
        attempt = 0;
      };

      ws.onmessage = (event) => {
        let msg: { type: string; auctions?: Auction[]; auction?: Auction };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === WS_MSG.AUCTIONS_LIST && msg.auctions) {
          const auctions = chainId ? msg.auctions.filter((a) => a.chainId === chainId) : msg.auctions;
          queryClient.setQueryData(queryKey(chainId), auctions);
        } else if (msg.type === WS_MSG.NEW_AUCTION && msg.auction) {
          if (chainId && msg.auction.chainId !== chainId) return;
          const auction = msg.auction;
          queryClient.setQueryData<Auction[]>(queryKey(chainId), (prev = []) => [auction, ...prev]);
        }
      };

      ws.onclose = () => {
        if (stopped) return;
        const delay = Math.min(30_000, 1_000 * 2 ** attempt);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [chainId, queryClient]);

  return query;
}
