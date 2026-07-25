import { useEffect, useState } from "react";
import { WS_MSG } from "@shared/constants";
import useWebSocket from "react-use-websocket";
import { apiWebSocketUrl } from "../lib/api";
import type { Nft } from "../lib/use-nfts";

export type DigRoomStatus =
  | { state: "pending" }
  | { state: "success"; nft: Nft }
  | { state: "failed"; error: string };

// Single-purpose counterpart to use-auction-room.ts - a dig request has
// exactly one terminal event (the sponsored mint confirms or fails), so
// there's no query-backed room state to keep in sync, just a status that
// flips once.
export function useDigRoom(requestId: string | null): DigRoomStatus {
  const [status, setStatus] = useState<DigRoomStatus>({ state: "pending" });

  useEffect(() => {
    setStatus({ state: "pending" });
  }, [requestId]);

  useWebSocket(requestId ? apiWebSocketUrl(`/faucet/${requestId}/room`) : null, {
    onMessage: (event) => {
      let msg: { type: string; status?: "success" | "failed"; nft?: Nft; error?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type !== WS_MSG.DIG_STATUS) return;
      if (msg.status === "success" && msg.nft) {
        setStatus({ state: "success", nft: msg.nft });
      } else if (msg.status === "failed") {
        setStatus({ state: "failed", error: msg.error ?? "Mint failed" });
      }
    },
    shouldReconnect: () => true,
    reconnectAttempts: 8,
    reconnectInterval: (attempt) => Math.min(15_000, 1_000 * 2 ** attempt),
  });

  return status;
}
