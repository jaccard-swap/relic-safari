import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WS_MSG } from "@shared/constants";
import { useAccount } from "wagmi";
import { apiJson, apiWebSocketUrl } from "./api";
import type { Auction } from "./auctions";
import type { Nft } from "./use-nfts";

export interface RoomEvent {
  id: string;
  type: "created" | "bid" | "chat" | "settled" | "cancelled" | string;
  actor: string;
  summary: Record<string, unknown> | null;
  timestamp: number;
}

interface AuctionDetails {
  auction: Auction;
  events: { id: string; type: string; actor: string; summary: Record<string, unknown> | null; createdAt: string }[];
  highestBid: string | null;
  nft: Nft | null;
}

function auctionQueryKey(auctionId: string) {
  return ["auction", auctionId] as const;
}

function fetchAuctionDetails(auctionId: string) {
  return apiJson<AuctionDetails>(`/auction/${auctionId}`);
}

// Settlement info is derived straight from `auction.status`/`winner`/
// `winningBid`/`settlementTxHash` (already returned by GET /:id), not just
// from a live 'settled' websocket event - the old app only ever populated
// this from the live stream, so a page load/reload *after* settlement never
// showed the result to anyone who wasn't connected at that exact moment.
export function useAuctionRoom(auctionId: string) {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: auctionQueryKey(auctionId),
    queryFn: () => fetchAuctionDetails(auctionId),
    enabled: !!auctionId,
  });

  const [connected, setConnected] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const addressRef = useRef(address);
  addressRef.current = address;

  useEffect(() => {
    if (!auctionId) return;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let stopped = false;
    const MAX_ATTEMPTS = 8;

    function connect() {
      const ws = new WebSocket(apiWebSocketUrl(`/auction/${auctionId}/room`));
      socketRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        setConnectionLost(false);
        if (addressRef.current) {
          ws.send(JSON.stringify({ type: WS_MSG.JOIN, address: addressRef.current }));
        }
      };

      ws.onmessage = (event) => {
        let msg: { type: string; count?: number };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === WS_MSG.JOINED || msg.type === WS_MSG.LEFT) {
          if (typeof msg.count === "number") setParticipantCount(msg.count);
        }
        if (msg.type === WS_MSG.EVENT) {
          // Server is the source of truth for everything an event implies
          // (highest bid, status, settlement) - refetch rather than
          // reconstruct state from the event payload piecemeal.
          void queryClient.invalidateQueries({ queryKey: auctionQueryKey(auctionId) });
        }
      };

      ws.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        if (stopped) return;
        if (attempt >= MAX_ATTEMPTS) {
          setConnectionLost(true);
          return;
        }
        const delay = Math.min(15_000, 1_000 * 2 ** attempt);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [auctionId, queryClient]);

  // Re-announce identity if the connected wallet changes mid-session.
  useEffect(() => {
    if (connected && address && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: WS_MSG.JOIN, address }));
    }
  }, [address, connected]);

  function sendChat(message: string) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: WS_MSG.CHAT, message }));
    }
  }

  const auction = query.data?.auction ?? null;
  const events: RoomEvent[] = (query.data?.events ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    actor: e.actor,
    summary: e.summary,
    timestamp: new Date(e.createdAt).getTime(),
  }));

  const settled =
    auction?.status === "settled" && auction.winner
      ? { winner: auction.winner, winningBid: auction.winningBid ?? undefined, txHash: auction.settlementTxHash ?? undefined }
      : null;

  return {
    auction,
    nft: query.data?.nft ?? null,
    highestBid: query.data?.highestBid ?? null,
    events,
    isLoading: query.isLoading,
    error: query.isError ? "Failed to load auction" : null,
    connected,
    connectionLost,
    participantCount,
    settled,
    sendChat,
    refetch: query.refetch,
  };
}
