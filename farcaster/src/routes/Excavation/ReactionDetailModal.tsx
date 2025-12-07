import type { PolymerizationRecord } from '../../hooks/usePolymerizationHistory'
import { InfoModal } from '../../components/InfoModal'

interface ReactionDetailModalProps {
  reaction: PolymerizationRecord | null
  onClose: () => void
}

export function ReactionDetailModal({ reaction, onClose }: ReactionDetailModalProps) {
  if (!reaction) return null

  const upgrades = Object.entries(reaction.upgradedTraits || {})
  const experience = Object.entries(reaction.experienceGained || {})
  const metadata = reaction.targetMetadata || {}
  const name = metadata.name || `Artifact #${reaction.targetTokenId?.slice(-6)}`
  const date = new Date(reaction.createdAt)

  return (
    <InfoModal
      open={true}
      onClose={onClose}
      title="Fusion Result"
      icon="⚗️"
    >
      {/* Target artifact */}
      <div className="mb-3">
        <div className="text-[10px] text-stone-500 mb-1">Target Artifact</div>
        <div className="p-2 rounded bg-purple-950/30 border border-purple-700/30">
          <div className="text-sm text-purple-200 font-medium">{name}</div>
          {metadata.rarity && (
            <div className="text-[10px] text-stone-400 mt-0.5">
              {metadata.rarity} {metadata.form || 'artifact'}
            </div>
          )}
        </div>
      </div>

      {/* Upgrades */}
      {upgrades.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-stone-500 mb-1">Trait Upgrades</div>
          <div className="space-y-1">
            {upgrades.map(([key, { from, to }]) => (
              <div key={key} className="flex items-center justify-between p-1.5 rounded bg-emerald-950/30 border border-emerald-700/30">
                <span className="text-[10px] text-stone-400 capitalize">{key}</span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-stone-500">{from}</span>
                  <span className="text-emerald-400">→</span>
                  <span className="text-emerald-300 font-medium">{to}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience gained */}
      {experience.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-stone-500 mb-1">Experience Gained</div>
          <div className="space-y-1">
            {experience.map(([key, xp]) => (
              <div key={key} className="flex items-center justify-between p-1.5 rounded bg-amber-950/30 border border-amber-700/30">
                <span className="text-[10px] text-stone-400 capitalize">{key}</span>
                <span className="text-[10px] text-amber-300 font-medium">+{xp} XP</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] text-stone-500 mt-1">
            Experience accumulates toward the next trait level
          </div>
        </div>
      )}

      {/* Essence yield */}
      {reaction.essenceYield > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-stone-500 mb-1">Essence Extracted</div>
          <div className="p-2 rounded bg-purple-950/30 border border-purple-700/30 text-center">
            <span className="text-lg text-purple-300">+{reaction.essenceYield} ✨</span>
            <div className="text-[8px] text-stone-500 mt-0.5">
              From non-matching traits on consumed artifact
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center p-1.5 rounded bg-stone-800/50">
          <div className="text-sm text-emerald-400">{upgrades.length}</div>
          <div className="text-[8px] text-stone-500">Upgrades</div>
        </div>
        <div className="text-center p-1.5 rounded bg-stone-800/50">
          <div className="text-sm text-amber-400">{experience.length}</div>
          <div className="text-[8px] text-stone-500">XP Gains</div>
        </div>
        <div className="text-center p-1.5 rounded bg-stone-800/50">
          <div className="text-sm text-purple-400">{reaction.essenceYield}</div>
          <div className="text-[8px] text-stone-500">Essence</div>
        </div>
      </div>

      {/* Technical details */}
      <div className="pt-2 border-t border-stone-700">
        <div className="text-stone-500 text-[9px] space-y-1">
          <div className="flex justify-between">
            <span>Date</span>
            <span className="text-stone-400">{date.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className={reaction.status === 'success' ? 'text-emerald-400' : 'text-stone-400'}>
              {reaction.status}
            </span>
          </div>
          {reaction.txHash && (
            <div className="flex justify-between">
              <span>Transaction</span>
              <span className="font-mono text-stone-400">
                {reaction.txHash.slice(0, 8)}...{reaction.txHash.slice(-6)}
              </span>
            </div>
          )}
        </div>
      </div>
    </InfoModal>
  )
}

