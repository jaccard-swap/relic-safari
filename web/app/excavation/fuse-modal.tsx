import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InfoModal } from "../components/info-modal";
import { useInvalidateNfts } from "../lib/use-nfts";
import { getExplorerTxUrl } from "../lib/explorer";
import { useFuseRoom } from "./use-fuse-room";
import type { FuseResult } from "./use-polymerization-history";

interface FuseModalProps {
  result: FuseResult | null;
  onClose: () => void;
  refetchEssence: () => void;
}

// Tracks a fusion from "hash in hand" through to the confirmed reveal (or a
// failure) via useFuseRoom - mirrors DigModal's shape for the quarry dig.
// refetchEssence is passed down from PolymeraseSection's own useBalances()
// instance rather than a second instance here, same fix as ClaimModal/Scrip -
// lands the refetch on the exact query observer feeding the visible balance.
export function FuseModal({ result, onClose, refetchEssence }: FuseModalProps) {
  const status = useFuseRoom(result?.requestId ?? null);
  const invalidateNfts = useInvalidateNfts();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status.state === "success") {
      invalidateNfts();
      void queryClient.invalidateQueries({ queryKey: ["polymerization-history"] });
      void refetchEssence();
    }
  }, [status.state, invalidateNfts, queryClient, refetchEssence]);

  if (!result) return null;

  const explorerUrl = getExplorerTxUrl(result.chainId, result.txHash);
  const upgrades = status.state === "success" ? Object.entries(status.upgradedTraits) : [];
  const name = (status.state === "success" ? (status.newMetadata.name as string | undefined) : undefined) ?? `Artifact #${result.targetTokenId.slice(-6)}`;
  const title = status.state === "success" ? "Fusion Complete!" : status.state === "failed" ? "Fusion Failed" : "Fusing...";
  const icon = status.state === "success" ? "✨" : status.state === "failed" ? "⚠️" : "⚗️";

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
          <p className="text-center text-xs text-stone-400">Fusing your artifacts on-chain...</p>
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
            <div className="text-sm font-medium text-purple-200">{name}</div>
          </div>
          {upgrades.length > 0 && (
            <div className="w-full space-y-1.5">
              {upgrades.map(([key, { from, to }]) => (
                <div key={key} className="flex items-center justify-between rounded border border-emerald-700/30 bg-emerald-950/30 p-2">
                  <span className="text-[13px] capitalize text-stone-400">{key}</span>
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-stone-500">{from}</span>
                    <span className="text-emerald-400">→</span>
                    <span className="font-medium text-emerald-300">{to}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {status.essenceYield > 0 && (
            <div className="w-full rounded border border-purple-700/30 bg-purple-950/30 p-3 text-center">
              <span className="text-lg text-purple-300">+{status.essenceYield} ✨</span>
              <div className="mt-1 text-[11px] text-stone-500">Essence extracted</div>
            </div>
          )}
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
