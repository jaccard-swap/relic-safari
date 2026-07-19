import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useNfts } from "../lib/use-nfts";
import { useBalances } from "../lib/use-balances";
import { usePolymeraseSimulation } from "./use-polymerase-simulation";
import { usePolymerizationHistory, useFuse, type PolymerizationRecord } from "./use-polymerization-history";
import { CollapsibleSection } from "../components/collapsible-section";
import { MiniNftCard } from "./mini-nft-card";
import { WorkbenchArtifact } from "./workbench-artifact";
import { SimulationPanel } from "./simulation-panel";
import { ReactionCard } from "./reaction-card";
import { ReactionDetailModal } from "./reaction-detail-modal";
import { Toast } from "../components/toast";

interface PolymeraseSectionProps {
  expanded: boolean;
  onToggle: () => void;
  onHelp: () => void;
  onReactionsHelp: () => void;
}

export function PolymeraseSection({ expanded, onToggle, onHelp, onReactionsHelp }: PolymeraseSectionProps) {
  const { data: nfts = [] } = useNfts();
  const [selectedNfts, setSelectedNfts] = useState<string[]>([]);
  const [detailReaction, setDetailReaction] = useState<PolymerizationRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { chainId } = useAccount();
  const { essenceBalance, refetchEssence } = useBalances();
  const { data: reactions = [], isLoading: reactionsLoading } = usePolymerizationHistory();

  const targetNftId = selectedNfts[0] || null;
  const consumedNftId = selectedNfts[1] || null;

  const targetNft = useMemo(() => nfts.find((n) => n.id === targetNftId), [nfts, targetNftId]);
  const consumedNft = useMemo(() => nfts.find((n) => n.id === consumedNftId), [nfts, consumedNftId]);

  const { data: simulation, isLoading: simLoading, error: simError } = usePolymeraseSimulation(targetNftId, consumedNftId);
  const fuse = useFuse();

  const toggleNftSelection = (id: string) => {
    setSelectedNfts((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const clearSelection = useCallback(() => {
    setSelectedNfts([]);
    fuse.reset();
  }, [fuse]);

  const swapSelection = () => {
    if (selectedNfts.length === 2) setSelectedNfts([selectedNfts[1], selectedNfts[0]]);
  };

  const handleFuse = useCallback(async () => {
    if (!targetNft || !consumedNft || simulation?.eligible !== true) return;

    try {
      const data = await fuse.mutateAsync({ targetTokenId: targetNft.tokenId, consumedTokenId: consumedNft.tokenId });
      const essenceMsg = data.essenceYield > 0 ? ` +${data.essenceYield} ✨` : "";
      setToast({ message: `Fusion complete!${essenceMsg}`, type: "success" });
      void refetchEssence();
      setTimeout(clearSelection, 2000);
    } catch (err) {
      setToast({ message: `Fusion failed: ${err instanceof Error ? err.message : "Unknown error"}`, type: "error" });
    }
  }, [targetNft, consumedNft, simulation?.eligible, fuse, refetchEssence, clearSelection]);

  const canFuse = selectedNfts.length === 2 && simulation?.eligible === true && !fuse.isPending;

  return (
    <>
      <CollapsibleSection
        title="Polymerase"
        icon="⚗️"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="font-mono text-sm text-purple-300">{essenceBalance?.count ?? 0}</span>
            <span className="text-[9px] text-stone-500">✨ Essence</span>
          </>
        }
        action={
          <button
            type="button"
            onClick={handleFuse}
            disabled={!canFuse}
            className={`relative w-14 rounded py-1.5 text-center text-xs font-medium transition-all ${
              canFuse ? "bg-gradient-to-r from-purple-600 to-violet-700 text-white hover:from-purple-500 hover:to-violet-600" : "cursor-not-allowed bg-stone-700 text-stone-400"
            }`}
          >
            {fuse.isPending ? "⏳" : fuse.isError ? "✗" : "Fuse"}
            {fuse.isSuccess && <span className="absolute -right-1 -top-1 text-[10px] text-green-400">✓</span>}
          </button>
        }
      >
        {targetNft && (
          <div className="mt-2 rounded-lg border border-purple-500/20 bg-gradient-to-br from-stone-900 via-purple-950/20 to-stone-900 p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 bg-clip-text text-[9px] font-semibold text-transparent">
                ◈ FUSION WORKBENCH
              </span>
              <button type="button" onClick={clearSelection} className="text-[8px] text-stone-500 hover:text-red-400">
                Clear
              </button>
            </div>

            {consumedNft ? (
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <WorkbenchArtifact nft={targetNft} role="target" />
                </div>
                <button
                  type="button"
                  onClick={swapSelection}
                  className="rounded border border-purple-700/30 bg-purple-900/30 p-1.5 text-purple-300 transition-colors hover:bg-purple-800/50 hover:text-purple-200"
                  title="Swap target and catalyst"
                >
                  ⇄
                </button>
                <div className="flex-1">
                  <WorkbenchArtifact nft={consumedNft} role="consumed" />
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-[180px]">
                <WorkbenchArtifact nft={targetNft} role="target" />
              </div>
            )}

            {consumedNft && (
              <div className="mt-2 border-t border-purple-500/20 pt-2">
                <SimulationPanel simulation={simulation} loading={simLoading} error={simError instanceof Error ? simError.message : null} />
              </div>
            )}

            {fuse.isSuccess && (
              <div className="mt-2 rounded border border-emerald-500/50 bg-emerald-950/40 p-2 text-center">
                <div className="text-sm text-emerald-400">✨ Fusion Complete!</div>
                <div className="text-[9px] text-stone-400">Artifact upgraded successfully</div>
              </div>
            )}
            {fuse.isError && (
              <div className="mt-2 rounded border border-red-500/50 bg-red-950/40 p-2 text-center">
                <div className="text-[10px] text-red-400">⚠️ {fuse.error instanceof Error ? fuse.error.message : "Fusion failed"}</div>
              </div>
            )}
            {fuse.isPending && (
              <div className="mt-2 rounded border border-purple-500/50 bg-purple-950/40 p-2 text-center">
                <div className="animate-pulse text-sm text-purple-400">⚗️ Fusing...</div>
                <div className="text-[9px] text-stone-400">Waiting for confirmation</div>
              </div>
            )}

            {!consumedNft && <div className="mt-2 text-center text-[9px] text-purple-300/70">Select catalyst artifact below ↓</div>}
          </div>
        )}

        <div className="mb-1 mt-2 flex items-center justify-between">
          <span className="text-[9px] text-stone-500">{!targetNft ? "Select target artifact" : !consumedNft ? "Select catalyst" : "Selected"}</span>
          <span className="text-[9px] text-amber-300">{selectedNfts.length}/2</span>
        </div>
        {nfts.length < 2 ? (
          <div className="py-2 text-center text-[9px] text-stone-500">Need at least 2 artifacts</div>
        ) : (
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {nfts.map((nft) => {
              const isTarget = nft.id === targetNftId;
              const isConsumed = nft.id === consumedNftId;
              return (
                <MiniNftCard
                  key={nft.id}
                  nft={nft}
                  selected={isTarget || isConsumed}
                  role={isTarget ? "target" : isConsumed ? "consumed" : undefined}
                  onSelect={() => toggleNftSelection(nft.id)}
                />
              );
            })}
          </div>
        )}

        <div className="mt-3 border-t border-purple-500/20 pt-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-medium text-purple-300">🧪 Recent Reactions</span>
            <button type="button" onClick={onReactionsHelp} className="text-[10px] text-stone-500 hover:text-purple-300">
              ?
            </button>
          </div>
          {reactionsLoading ? (
            <div className="animate-pulse py-2 text-center text-[9px] text-stone-500">Loading...</div>
          ) : reactions.length === 0 ? (
            <div className="py-2 text-center text-[9px] text-stone-500">No fusions yet</div>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {reactions.map((reaction) => (
                <ReactionCard key={reaction.id} reaction={reaction} onClick={() => setDetailReaction(reaction)} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <ReactionDetailModal reaction={detailReaction} onClose={() => setDetailReaction(null)} chainId={chainId} />

      {toast && <Toast message={toast.message} type={toast.type} duration={4000} onClose={() => setToast(null)} />}
    </>
  );
}
