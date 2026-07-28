import { useEffect, useState } from "react";
import { WS_MSG } from "@shared/constants";
import useWebSocket from "react-use-websocket";
import { apiWebSocketUrl } from "../lib/api";

export type MuseumRoomStatus =
  | { state: "pending" }
  | {
      state: "success";
      txHash: string;
      site: string;
      age: string;
      material: string;
      points: number;
      badgeId: string | null;
    }
  | { state: "failed"; error: string };

// Client counterpart to use-upgrade-room.ts for the Museum cupboard-freeze
// flow - a completion has exactly one terminal event (confirmed or failed).
export function useMuseumRoom(requestId: string | null): MuseumRoomStatus {
  const [status, setStatus] = useState<MuseumRoomStatus>({ state: "pending" });

  useEffect(() => {
    setStatus({ state: "pending" });
  }, [requestId]);

  useWebSocket(requestId ? apiWebSocketUrl(`/museum/${requestId}/room`) : null, {
    onMessage: (event) => {
      let msg: {
        type: string;
        status?: "success" | "failed";
        txHash?: string;
        site?: string;
        age?: string;
        material?: string;
        points?: number;
        badgeId?: string | null;
        error?: string;
      };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type !== WS_MSG.MUSEUM_STATUS) return;
      if (msg.status === "success" && msg.site && msg.age && msg.material) {
        setStatus({
          state: "success",
          txHash: msg.txHash ?? "",
          site: msg.site,
          age: msg.age,
          material: msg.material,
          points: msg.points ?? 0,
          badgeId: msg.badgeId ?? null,
        });
      } else if (msg.status === "failed") {
        setStatus({ state: "failed", error: msg.error ?? "Completion failed" });
      }
    },
    shouldReconnect: () => true,
    reconnectAttempts: 8,
    reconnectInterval: (attempt) => Math.min(15_000, 1_000 * 2 ** attempt),
  });

  return status;
}
