import type { PolymerizationRecord } from '../../hooks/usePolymerizationHistory'

interface ReactionCardProps {
  reaction: PolymerizationRecord
  onClick?: () => void
}

export function ReactionCard({ reaction, onClick }: ReactionCardProps) {
  const upgrades = Object.entries(reaction.upgradedTraits || {})
  const experience = Object.entries(reaction.experienceGained || {})
  const name = reaction.targetMetadata?.name || `Artifact #${reaction.targetTokenId?.slice(-6)}`
  const timeAgo = getTimeAgo(new Date(reaction.createdAt))

  return (
    <div 
      onClick={onClick}
      className={`p-1.5 rounded border border-purple-900/30 bg-purple-950/20 ${onClick ? 'cursor-pointer hover:bg-purple-950/40 hover:border-purple-700/50 transition-colors' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[9px] text-purple-200 truncate font-medium">
            ⚗️ {name}
          </div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {/* Upgrades */}
            {upgrades.map(([key, { from, to }]) => (
              <span key={key} className="text-[8px] px-1 py-0.5 bg-emerald-950/50 border border-emerald-700/30 rounded text-emerald-300">
                ⬆ {key}: {from} → {to}
              </span>
            ))}
            {/* Experience gained */}
            {experience.map(([key, xp]) => (
              <span key={key} className="text-[8px] px-1 py-0.5 bg-amber-950/50 border border-amber-700/30 rounded text-amber-300">
                +{xp} {key} XP
              </span>
            ))}
            {/* Essence yield */}
            {reaction.essenceYield > 0 && (
              <span className="text-[8px] px-1 py-0.5 bg-purple-950/50 border border-purple-700/30 rounded text-purple-300">
                +{reaction.essenceYield} ✨
              </span>
            )}
          </div>
        </div>
        <div className="text-[8px] text-stone-500 whitespace-nowrap">
          {timeAgo}
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

