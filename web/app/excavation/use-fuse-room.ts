import { useEffect, useState } from "react";
import { WS_MSG } from "@shared/constants";
import useWebSocket from "react-use-websocket";
import { apiWebSocketUrl } from "../lib/api";

export type FuseRoomStatus =
  | { state: "pending" }
  | {
      state: "success";
      txHash: string;
      targetTokenId: string;
      newMetadata: Record<string, unknown>;
      upgradedTraits: Record<string, { from: string; to: string }>;
      essenceYield: number;
    }
  | { state: "failed"; error: string };

// Client counterpart to use-dig-room.ts for the fuse flow - a fusion has
// exactly one terminal event (confirmed or failed), so this is a status that
// flips once rather than query-backed room state.
export function useFuseRoom(requestId: string | null): FuseRoomStatus {
  const [status, setStatus] = useState<FuseRoomStatus>({ state: "pending" });

  useEffect(() => {
    setStatus({ state: "pending" });
  }, [requestId]);

  useWebSocket(requestId ? apiWebSocketUrl(`/faucet/polymerase/${requestId}/room`) : null, {
    onMessage: (event) => {
      let msg: {
        type: string;
        status?: "success" | "failed";
        txHash?: string;
        targetTokenId?: string;
        newMetadata?: Record<string, unknown>;
        upgradedTraits?: Record<string, { from: string; to: string }>;
        essenceYield?: number;
        error?: string;
      };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type !== WS_MSG.POLYMERASE_STATUS) return;
      if (msg.status === "success" && msg.targetTokenId && msg.newMetadata) {
        setStatus({
          state: "success",
          txHash: msg.txHash ?? "",
          targetTokenId: msg.targetTokenId,
          newMetadata: msg.newMetadata,
          upgradedTraits: msg.upgradedTraits ?? {},
          essenceYield: msg.essenceYield ?? 0,
        });
      } else if (msg.status === "failed") {
        setStatus({ state: "failed", error: msg.error ?? "Fusion failed" });
      }
    },
    shouldReconnect: () => true,
    reconnectAttempts: 8,
    reconnectInterval: (attempt) => Math.min(15_000, 1_000 * 2 ** attempt),
  });

  return status;
}
