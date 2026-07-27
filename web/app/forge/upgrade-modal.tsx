import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InfoModal } from "../components/info-modal";
import { useInvalidateNfts } from "../lib/use-nfts";
import { getExplorerTxUrl } from "../lib/explorer";
import { useUpgradeRoom } from "./use-upgrade-room";
import type { UpgradeResult } from "./use-upgrade-trait";

interface UpgradeModalProps {
  result: UpgradeResult | null;
  onClose: () => void;
  refetchEssence: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Tracks a Forge upgrade from "hash in hand" through to the confirmed reveal
// (or a failure) via useUpgradeRoom - mirrors FuseModal's shape. Works for
// both a real trait bump and an Overflow spend (traitKey === 'overflow'),
// since the backend/contract treat them identically.
export function UpgradeModal({ result, onClose, refetchEssence }: UpgradeModalProps) {
  const status = useUpgradeRoom(result?.requestId ?? null);
  const invalidateNfts = useInvalidateNfts();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status.state === "success" && result) {
      invalidateNfts();
      void queryClient.invalidateQueries({ queryKey: ["forge-simulation"] });
      void refetchEssence();
    }
  }, [status.state, result, invalidateNfts, queryClient, refetchEssence]);

  if (!result) return null;

  const isOverflow = result.traitKey === "overflow";
  const explorerUrl = getExplorerTxUrl(result.chainId, result.txHash);
  const title = status.state === "success" ? "Upgrade Complete!" : status.state === "failed" ? "Upgrade Failed" : "Forging...";
  const icon = status.state === "success" ? "✨" : status.state === "failed" ? "⚠️" : "🔨";

  return (
    <InfoModal open={true} onClose={onClose} title={title} icon={icon}>
      {status.state === "pending" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative h-16 w-16">
            <span className="absolute inset-0 flex items-center justify-center text-3xl [animation:alchemy-glow_1.6s_ease-in-out_infinite]">⚗️</span>
            <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite]">✨</span>
            <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite] [animation-delay:-0.8s]">✨</span>
            <span className="absolute inset-0 flex items-center justify-center text-sm [animation:alchemy-orbit_2.4s_linear_infinite] [animation-delay:-1.6s]">✨</span>
          </div>
          <p className="text-center text-xs text-stone-400">Spending {result.essenceCost} Essence on-chain...</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 underline hover:text-purple-300">
              View pending transaction ↗
            </a>
          )}
        </div>
      )}

      {status.state === "success" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="w-full rounded-lg border border-purple-700/30 bg-purple-950/30 p-3 text-center [animation:treasure-reveal_0.6s_ease-out]">
            <div className="text-sm font-medium text-purple-200">{isOverflow ? "Overflow" : cap(status.traitKey)}</div>
            <div className="mt-1 flex items-center justify-center gap-2 text-[13px]">
              <span className="text-stone-500">{status.fromValue}</span>
              <span className="text-emerald-400">→</span>
              <span className="font-medium text-emerald-300">{status.toValue}</span>
            </div>
          </div>
          <div className="w-full rounded border border-purple-700/30 bg-purple-950/30 p-3 text-center">
            <span className="text-lg text-purple-300">-{status.essenceCost} ✨</span>
            <div className="mt-1 text-[11px] text-stone-500">Essence spent</div>
          </div>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 underline hover:text-purple-300">
              View transaction ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="w-full rounded bg-purple-700/80 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-600">
            Nice!
          </button>
        </div>
      )}

      {status.state === "failed" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-3xl">⚠️</span>
          <p className="text-center text-xs text-red-400">{status.error}</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 underline hover:text-purple-300">
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
