import { useState } from "react";
import { useNfts } from "../lib/use-nfts";
import { useBalances } from "../lib/use-balances";
import { useAuthGate } from "../auth/use-auth-gate";
import { useForgeSimulation } from "./use-forge-simulation";
import { useUpgradeTrait } from "./use-upgrade-trait";
import { UpgradeModal } from "./upgrade-modal";
import { MiniNftCard } from "../excavation/mini-nft-card";
import { CollapsibleSection } from "../components/collapsible-section";
import { Toast } from "../components/toast";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ForgePage() {
  const { data: nfts = [] } = useNfts();
  const [selectedNftId, setSelectedNftId] = useState<string | null>(null);
  const [pickerExpanded, setPickerExpanded] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const authenticated = useAuthGate();
  const { essenceBalance, refetchEssence } = useBalances();
  const { data: simulation, isLoading: simLoading } = useForgeSimulation(selectedNftId);
  const upgrade = useUpgradeTrait();

  const selectedNft = nfts.find((n) => n.id === selectedNftId) ?? null;

  const handleUpgrade = async (traitKey: string) => {
    if (!selectedNft) return;
    if (!authenticated) {
      setToast({ message: "Sign in to forge upgrades", type: "error" });
      return;
    }
    try {
      await upgrade.mutateAsync({ tokenId: selectedNft.tokenId, traitKey });
    } catch (err) {
      setToast({ message: `Upgrade failed: ${err instanceof Error ? err.message : "Unknown error"}`, type: "error" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-amber-900/30 bg-stone-800/50 p-3">
        <span className="text-xs font-semibold text-amber-300">🔨 Forge</span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-sm text-purple-300">{essenceBalance?.count ?? 0}</span>
          <span className="text-xs text-stone-500">✨ Essence</span>
        </span>
      </div>

      <p className="text-[13px] leading-relaxed text-stone-400">
        Spend Essence directly on one artifact - no second artifact consumed. Once every trait is maxed, Energy Infusion unlocks as an uncapped sink.
      </p>

      <CollapsibleSection
        title="Select an artifact"
        icon="🗂️"
        expanded={pickerExpanded}
        onToggle={() => setPickerExpanded((v) => !v)}
        summary={
          <span className="text-[13px] text-stone-400">
            {selectedNft ? (selectedNft.metadata.name as string) ?? `Artifact #${selectedNft.tokenId.slice(-6)}` : "None selected"}
          </span>
        }
      >
        {nfts.length === 0 ? (
          <div className="py-3 text-center text-xs text-stone-500">No artifacts yet</div>
        ) : (
          <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-40 space-y-1 overflow-y-auto pt-2">
            {nfts.map((nft) => (
              <MiniNftCard
                key={nft.id}
                nft={nft}
                selected={nft.id === selectedNftId}
                onSelect={() => {
                  setSelectedNftId((prev) => (prev === nft.id ? null : nft.id));
                  setPickerExpanded(false);
                }}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {selectedNft && (
        <div className="rounded-lg border border-purple-500/20 bg-gradient-to-br from-stone-900 via-purple-950/20 to-stone-900 p-3">
          <div className="mb-2 text-xs font-semibold text-purple-300">{(selectedNft.metadata.name as string) ?? `Artifact #${selectedNft.tokenId.slice(-6)}`}</div>

          {simLoading && <div className="animate-pulse py-3 text-center text-xs text-stone-500">Loading traits...</div>}

          {simulation && (
            <div className="space-y-1.5">
              {Object.entries(simulation.traits)
                .filter(([, t]) => t.upgradeable)
                .map(([key, trait]) => (
                  <div key={key} className="flex items-center justify-between rounded border border-purple-700/30 bg-purple-950/20 p-2">
                    <div>
                      <div className="text-[13px] text-stone-300">{cap(key)}</div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-stone-500">{trait.current}</span>
                        {trait.next && (
                          <>
                            <span className="text-purple-400">→</span>
                            <span className="text-purple-300">{trait.next.value}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {trait.next ? (
                      <button
                        type="button"
                        onClick={() => handleUpgrade(key)}
                        disabled={authenticated && (upgrade.isPending || (essenceBalance?.count ?? 0) < trait.next.cost)}
                        title={!authenticated ? "Sign in to forge upgrades" : undefined}
                        className={`rounded px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-400 ${
                          authenticated
                            ? "bg-gradient-to-r from-purple-600 to-violet-700 text-white hover:from-purple-500 hover:to-violet-600"
                            : "bg-stone-800 text-stone-500 opacity-60 hover:opacity-80"
                        }`}
                      >
                        {!authenticated && "🔒 "}
                        {trait.next.cost} ✨
                      </button>
                    ) : (
                      <span className="text-[11px] text-stone-500">Maxed</span>
                    )}
                  </div>
                ))}

              {simulation.overflow && (
                <div className="mt-3 flex items-center justify-between rounded border border-amber-600/40 bg-gradient-to-r from-amber-950/40 to-purple-950/30 p-2">
                  <div>
                    <div className="text-[13px] font-semibold text-amber-300">⚡ Energy Infusion</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-stone-500">{simulation.overflow.currentLevel}</span>
                      <span className="text-amber-400">→</span>
                      <span className="text-amber-300">{simulation.overflow.currentLevel + 1}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpgrade("overflow")}
                    disabled={authenticated && (upgrade.isPending || (essenceBalance?.count ?? 0) < simulation.overflow.cost)}
                    title={!authenticated ? "Sign in to forge upgrades" : undefined}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-400 ${
                      authenticated
                        ? "bg-gradient-to-r from-amber-600 to-yellow-700 text-white hover:from-amber-500 hover:to-yellow-600"
                        : "bg-stone-800 text-stone-500 opacity-60 hover:opacity-80"
                    }`}
                  >
                    {!authenticated && "🔒 "}
                    {simulation.overflow.cost} ✨
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <UpgradeModal result={upgrade.data ?? null} onClose={() => upgrade.reset()} refetchEssence={refetchEssence} />

      {toast && <Toast message={toast.message} type={toast.type} duration={4000} onClose={() => setToast(null)} />}
    </div>
  );
}
