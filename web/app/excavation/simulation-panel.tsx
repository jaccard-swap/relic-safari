import type { SimulationResult } from "./use-polymerase-simulation";
import { BandMatcher } from "./band-matcher";
import {
  AGE_STYLES,
  FORM_EMOJI,
  INSCRIPTION_EMOJI,
  MATERIAL_STYLES,
  QUALITY_EMOJI,
  RARITY_EMOJI,
  SITE_STYLES,
  getCardStyles,
  getNameStyles,
  getResonanceTierStyles,
} from "../lib/artifact-styles";

interface SimulationPanelProps {
  simulation: SimulationResult | undefined;
  loading: boolean;
  error: string | null;
}

export function SimulationPanel({ simulation, loading, error }: SimulationPanelProps) {
  if (loading) {
    return (
      <div className="py-4 text-center">
        <div className="animate-pulse text-lg text-purple-400">⚗️</div>
        <div className="text-xs text-stone-400">Analyzing resonance...</div>
      </div>
    );
  }

  if (error) {
    return <div className="py-3 text-center text-xs text-red-400">⚠️ {error}</div>;
  }

  if (!simulation) return null;

  const { eligible, tier, minHash, traitBreakdown, result } = simulation;
  const tierStyle = getResonanceTierStyles(tier);

  const newMetadata = result?.newMetadata ?? {};
  const resultRarity = (newMetadata.rarity as string) || "common";
  const resultForm = newMetadata.form as string;
  const resultQuality = newMetadata.quality as string;
  const resultInscription = newMetadata.inscription as string;
  const resultAge = newMetadata.age as string;
  const resultMaterial = newMetadata.material as string;
  const resultSite = newMetadata.site as string;
  const resultCardStyles = getCardStyles(resultRarity);
  const resultNameStyles = getNameStyles(resultRarity);

  return (
    <div className="space-y-3">
      <div className={`rounded border p-3 ${tierStyle.border} ${tierStyle.bg}`}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-stone-400">MinHash Resonance</span>
          <span className={`font-mono text-[13px] ${tierStyle.text}`}>
            {minHash.matchCount}/{minHash.bands.length}
          </span>
        </div>
        <BandMatcher bands={minHash.bands} />
        <div className={`mt-1.5 flex items-center justify-center gap-1.5 text-[11px] ${tierStyle.text}`}>
          <span>{eligible ? "✓" : "✗"} {tierStyle.label}</span>
          {eligible && <span className="text-stone-500">· {tierStyle.multiplier} essence</span>}
        </div>
      </div>

      {eligible && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-stone-500">Trait Analysis</div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {Object.entries(traitBreakdown).map(([key, info]) => {
                if (!info.target && !info.consumed) return null;
                return (
                  <div key={key} className="flex items-center justify-between rounded bg-stone-800/50 px-1.5 py-1 text-[11px]">
                    <span className="capitalize text-stone-400">{key}</span>
                    <div className="flex items-center gap-1.5">
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
          </div>

          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-stone-500">Fusion Result</div>
            <div className={`flex w-full flex-col gap-1.5 rounded-lg border p-2 text-left ${resultCardStyles}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs">{RARITY_EMOJI[resultRarity]}</span>
                <span className="text-[9px] font-medium text-purple-300">NEW</span>
              </div>
              <div className="flex h-14 items-center justify-center rounded bg-black/30 text-3xl">
                {resultForm ? FORM_EMOJI[resultForm] || "⚱️" : "⚱️"}
              </div>
              <div className={`truncate text-xs ${resultNameStyles}`}>{newMetadata.name as string}</div>
              <div className="flex flex-wrap gap-1 text-xs">
                {resultAge && <span title={resultAge}>{AGE_STYLES[resultAge]?.emoji}</span>}
                {resultMaterial && <span title={resultMaterial}>{MATERIAL_STYLES[resultMaterial]?.emoji}</span>}
                {resultQuality && <span title={resultQuality}>{QUALITY_EMOJI[resultQuality]}</span>}
                {resultInscription && resultInscription !== "unmarked" && (
                  <span title={resultInscription}>{INSCRIPTION_EMOJI[resultInscription]}</span>
                )}
                {resultSite && <span title={resultSite}>{SITE_STYLES[resultSite]?.emoji}</span>}
              </div>
              <div className="mt-0.5 flex items-center justify-between border-t border-white/10 pt-1.5">
                <span className="text-[11px] text-stone-400">Essence yield</span>
                <span className="font-mono text-[13px] text-purple-300">+{result.essenceYield} ✨</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
