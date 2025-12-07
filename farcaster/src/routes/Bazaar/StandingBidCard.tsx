import { formatEther } from 'viem'
import type { StandingBid } from '../../hooks/useStandingBids'
import { TRAIT_EMOJI } from './TraitChip'

interface StandingBidCardProps {
  bid: StandingBid
}

export function StandingBidCard({ bid }: StandingBidCardProps) {
  const traits = bid.desiredTraits as Record<string, string>
  const traitCount = Object.keys(traits).length
  const amountDisplay = formatEther(BigInt(bid.amount))
  const deadline = new Date(bid.deadline)
  const isExpired = deadline < new Date()
  
  return (
    <div className={`p-1.5 rounded border ${isExpired ? 'border-red-900/30 bg-red-950/20' : 'border-amber-900/30 bg-stone-900/50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-[9px]">
            <span className="text-amber-300 font-mono">{parseFloat(amountDisplay).toFixed(0)} SCRIP</span>
            <span className="text-stone-500">•</span>
            <span className="text-stone-400">{bid.minMatches}/5 match</span>
          </div>
          <div className="flex flex-wrap gap-0.5 mt-0.5">
            {Object.entries(traits).slice(0, 3).map(([key, value]) => (
              <span key={key} className="text-[8px] px-1 py-0.5 bg-stone-800/50 rounded text-stone-400">
                {TRAIT_EMOJI[key] || '🔹'} {value}
              </span>
            ))}
            {traitCount > 3 && (
              <span className="text-[8px] text-stone-500">+{traitCount - 3}</span>
            )}
          </div>
        </div>
        <div className="text-[8px] text-stone-500">
          {isExpired ? (
            <span className="text-red-400">Expired</span>
          ) : (
            <span>{Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d left</span>
          )}
        </div>
      </div>
    </div>
  )
}

