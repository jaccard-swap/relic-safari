import type { usePolymeraseSimulation } from '../../hooks/usePolymeraseSimulation'
import { BandMatcher } from './BandMatcher'

interface SimulationPanelProps {
  simulation: ReturnType<typeof usePolymeraseSimulation>['simulation']
  loading: boolean
  error: string | null
}

export function SimulationPanel({ simulation, loading, error }: SimulationPanelProps) {
  if (loading) {
    return (
      <div className="text-center py-3">
        <div className="animate-pulse text-purple-400 text-lg">⚗️</div>
        <div className="text-[9px] text-stone-400">Analyzing resonance...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-2 text-red-400 text-[9px]">
        ⚠️ {error}
      </div>
    )
  }

  if (!simulation) return null

  const { eligible, minHash, traitBreakdown, result } = simulation

  return (
    <div className="space-y-2">
      {/* Band match visualization */}
      <div className={`p-2 rounded border ${eligible ? 'border-emerald-500/30 bg-emerald-950/30' : 'border-red-500/30 bg-red-950/30'}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-stone-400">MinHash Resonance</span>
          <span className={`text-[10px] font-mono ${eligible ? 'text-emerald-400' : 'text-red-400'}`}>
            {minHash.matchCount}/{minHash.bands.length}
          </span>
        </div>
        <BandMatcher bands={minHash.bands} />
        <div className={`text-[8px] text-center mt-1 ${eligible ? 'text-emerald-300' : 'text-red-300'}`}>
          {eligible ? '✓ Fusion possible' : '✗ Insufficient resonance'}
        </div>
      </div>

      {/* Trait breakdown */}
      {eligible && (
        <>
          <div className="text-[8px] text-stone-500 uppercase tracking-wider">Trait Analysis</div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {Object.entries(traitBreakdown).map(([key, info]) => {
              if (!info.target && !info.consumed) return null
              return (
                <div key={key} className="flex items-center justify-between text-[8px] px-1 py-0.5 rounded bg-stone-800/50">
                  <span className="text-stone-400 capitalize">{key}</span>
                  <div className="flex items-center gap-1">
                    {info.action === 'upgrade' && (
                      <span className="text-emerald-400">⬆ {info.target} → {result.upgradedTraits[key]?.to}</span>
                    )}
                    {info.action === 'essence' && (
                      <span className="text-purple-400">✨ +essence</span>
                    )}
                    {info.action === 'keep' && (
                      <span className="text-stone-500">{info.target}</span>
                    )}
                    {info.action === 'none' && info.target && (
                      <span className="text-stone-500">{info.target}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Result preview */}
          <div className="p-2 rounded border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-violet-950/40">
            <div className="text-[9px] text-purple-300 font-medium mb-1">⚗️ Fusion Result</div>
            <div className="text-[10px] text-white/90 truncate">{result.newMetadata.name}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[8px] text-stone-400">Essence yield</span>
              <span className="text-[10px] text-purple-300 font-mono">+{result.essenceYield} ✨</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

