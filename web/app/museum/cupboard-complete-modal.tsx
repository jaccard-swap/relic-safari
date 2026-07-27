import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InfoModal } from "../components/info-modal";
import { useInvalidateNfts } from "../lib/use-nfts";
import { getExplorerTxUrl } from "../lib/explorer";
import { useMuseumRoom } from "./use-museum-room";
import type { CompleteCupboardResult } from "./use-complete-cupboard";

interface CupboardCompleteModalProps {
  result: CompleteCupboardResult | null;
  onClose: () => void;
  refetchBadgeCount: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Tracks a cupboard freeze from "hash in hand" through to the confirmed
// badge reveal (or a failure) via useMuseumRoom - mirrors UpgradeModal's shape.
export function CupboardCompleteModal({ result, onClose, refetchBadgeCount }: CupboardCompleteModalProps) {
  const status = useMuseumRoom(result?.requestId ?? null);
  const invalidateNfts = useInvalidateNfts();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status.state === "success" && result) {
      invalidateNfts();
      void queryClient.invalidateQueries({ queryKey: ["museum-progress"] });
      void refetchBadgeCount();
    }
  }, [status.state, result, invalidateNfts, queryClient, refetchBadgeCount]);

  if (!result) return null;

  const explorerUrl = getExplorerTxUrl(result.chainId, result.txHash);
  const title = status.state === "success" ? "Cupboard Frozen!" : status.state === "failed" ? "Freeze Failed" : "Freezing Cupboard...";
  const icon = status.state === "success" ? "🏅" : status.state === "failed" ? "⚠️" : "🏺";

  return (
    <InfoModal open={true} onClose={onClose} title={title} icon={icon}>
      {status.state === "pending" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative h-16 w-16">
            <span className="absolute inset-0 flex items-center justify-center text-3xl [animation:alchemy-glow_1.6s_ease-in-out_infinite]">🏺</span>
            <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite]">✨</span>
            <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite] [animation-delay:-0.8s]">✨</span>
            <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite] [animation-delay:-1.6s]">✨</span>
          </div>
          <p className="text-center text-xs text-stone-400">
            Sealing {cap(result.material)} {cap(result.age)} artifacts from the {cap(result.site.replace(/-/g, " "))} on-chain...
          </p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 underline hover:text-teal-300">
              View pending transaction ↗
            </a>
          )}
        </div>
      )}

      {status.state === "success" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-full rounded-lg border border-teal-700/30 bg-teal-950/30 p-3 text-center [animation:treasure-reveal_0.6s_ease-out]">
            <div className="text-sm font-medium text-teal-200">
              {cap(status.material)} · {cap(status.age)} · {cap(status.site.replace(/-/g, " "))}
            </div>
            <div className="mt-1 text-[13px] text-stone-400">7 artifacts sealed into a permanent, soulbound badge</div>
          </div>
          <div className="w-full rounded border border-teal-700/30 bg-teal-950/30 p-3 text-center">
            <span className="text-lg text-teal-300">+{status.points} 🏅</span>
            <div className="mt-1 text-[11px] text-stone-500">Leaderboard points earned</div>
          </div>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 underline hover:text-teal-300">
              View transaction ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="w-full rounded bg-teal-700/80 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-600">
            Nice!
          </button>
        </div>
      )}

      {status.state === "failed" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-3xl">⚠️</span>
          <p className="text-center text-xs text-red-400">{status.error}</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-400 underline hover:text-teal-300">
              View transaction ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="w-full rounded bg-stone-700 py-2 text-xs font-medium text-white transition-colors hover:bg-stone-600">
            Close
          </button>
        </div>
      )}
    </InfoModal>
  );
}
