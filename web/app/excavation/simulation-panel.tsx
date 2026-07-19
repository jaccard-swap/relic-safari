import type { SimulationResult } from "./use-polymerase-simulation";
import { BandMatcher } from "./band-matcher";

interface SimulationPanelProps {
  simulation: SimulationResult | undefined;
  loading: boolean;
  error: string | null;
}

export function SimulationPanel({ simulation, loading, error }: SimulationPanelProps) {
  if (loading) {
    return (
      <div className="py-3 text-center">
        <div className="animate-pulse text-lg text-purple-400">⚗️</div>
        <div className="text-[9px] text-stone-400">Analyzing resonance...</div>
      </div>
    );
  }

  if (error) {
    return <div className="py-2 text-center text-[9px] text-red-400">⚠️ {error}</div>;
  }

  if (!simulation) return null;

  const { eligible, minHash, traitBreakdown, result } = simulation;

  return (
    <div className="space-y-2">
      <div className={`rounded border p-2 ${eligible ? "border-emerald-500/30 bg-emerald-950/30" : "border-red-500/30 bg-red-950/30"}`}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9px] text-stone-400">MinHash Resonance</span>
          <span className={`font-mono text-[10px] ${eligible ? "text-emerald-400" : "text-red-400"}`}>
            {minHash.matchCount}/{minHash.bands.length}
          </span>
        </div>
        <BandMatcher bands={minHash.bands} />
        <div className={`mt-1 text-center text-[8px] ${eligible ? "text-emerald-300" : "text-red-300"}`}>
          {eligible ? "✓ Fusion possible" : "✗ Insufficient resonance"}
        </div>
      </div>

      {eligible && (
        <>
          <div className="text-[8px] uppercase tracking-wider text-stone-500">Trait Analysis</div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto">
            {Object.entries(traitBreakdown).map(([key, info]) => {
              if (!info.target && !info.consumed) return null;
              return (
                <div key={key} className="flex items-center justify-between rounded bg-stone-800/50 px-1 py-0.5 text-[8px]">
                  <span className="capitalize text-stone-400">{key}</span>
                  <div className="flex items-center gap-1">
                    {info.action === "upgrade" && (
                      <span className="text-emerald-400">
                        ⬆ {info.target} → {result.upgradedTraits[key]?.to}
                      </span>
                    )}
                    {info.action === "essence" && <span className="text-purple-400">✨ +essence</span>}
                    {info.action === "keep" && <span className="text-stone-500">{info.target}</span>}
                    {info.action === "none" && info.target && <span className="text-stone-500">{info.target}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-violet-950/40 p-2">
            <div className="mb-1 text-[9px] font-medium text-purple-300">⚗️ Fusion Result</div>
            <div className="truncate text-[10px] text-white/90">{result.newMetadata.name}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[8px] text-stone-400">Essence yield</span>
              <span className="font-mono text-[10px] text-purple-300">+{result.essenceYield} ✨</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
