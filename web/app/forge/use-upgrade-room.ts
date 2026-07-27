import { useEffect, useState } from "react";
import { WS_MSG } from "@shared/constants";
import useWebSocket from "react-use-websocket";
import { apiWebSocketUrl } from "../lib/api";

export type UpgradeRoomStatus =
  | { state: "pending" }
  | {
      state: "success";
      txHash: string;
      tokenId: string;
      traitKey: string;
      fromValue: string;
      toValue: string;
      essenceCost: number;
      newMetadata: Record<string, unknown>;
    }
  | { state: "failed"; error: string };

// Client counterpart to use-fuse-room.ts for the Forge upgrade flow - an
// upgrade has exactly one terminal event (confirmed or failed).
export function useUpgradeRoom(requestId: string | null): UpgradeRoomStatus {
  const [status, setStatus] = useState<UpgradeRoomStatus>({ state: "pending" });

  useEffect(() => {
    setStatus({ state: "pending" });
  }, [requestId]);

  useWebSocket(requestId ? apiWebSocketUrl(`/forge/${requestId}/room`) : null, {
    onMessage: (event) => {
      let msg: {
        type: string;
        status?: "success" | "failed";
        txHash?: string;
        tokenId?: string;
        traitKey?: string;
        fromValue?: string;
        toValue?: string;
        essenceCost?: number;
        newMetadata?: Record<string, unknown>;
        error?: string;
      };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type !== WS_MSG.UPGRADE_STATUS) return;
      if (msg.status === "success" && msg.tokenId && msg.traitKey) {
        setStatus({
          state: "success",
          txHash: msg.txHash ?? "",
          tokenId: msg.tokenId,
          traitKey: msg.traitKey,
          fromValue: msg.fromValue ?? "",
          toValue: msg.toValue ?? "",
          essenceCost: msg.essenceCost ?? 0,
          newMetadata: msg.newMetadata ?? {},
        });
      } else if (msg.status === "failed") {
        setStatus({ state: "failed", error: msg.error ?? "Upgrade failed" });
      }
    },
    shouldReconnect: () => true,
    reconnectAttempts: 8,
    reconnectInterval: (attempt) => Math.min(15_000, 1_000 * 2 ** attempt),
  });

  return status;
}
