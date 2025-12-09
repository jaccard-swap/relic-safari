import { formatEther } from 'viem'
import type { Chain } from 'viem'
import { shortenAddress } from './utils'
import { getExplorerUrl } from '../../utils/explorer'
import type { AuctionEvent } from '../../hooks/useAuctionRoom'

interface EventItemProps {
  event: AuctionEvent
  isOwn: boolean
  chain?: Chain
}

export function EventItem({ event, isOwn, chain }: EventItemProps) {
  const { type, actor, summary, timestamp } = event

  const txUrl = summary.txHash && chain 
    ? getExplorerUrl(chain, summary.txHash, 'transaction') 
    : null

  // Render based on event type
  const renderContent = () => {
    switch (type) {
      case 'created':
        return (
          <span className="text-stone-400">
            🏛️ Auction created
          </span>
        )
      case 'bid':
        return (
          <span className="text-amber-300">
            💰 {formatEther(BigInt(summary.amount || '0'))} SCRIP
          </span>
        )
      case 'chat':
        return (
          <span className="text-stone-300">
            {summary.message}
          </span>
        )
      case 'settled':
        return (
          <span className="text-green-300">
            🎉 Settled to {shortenAddress(summary.winner || '')}
            {summary.amount && ` for ${summary.amount} SCRIP`}
          </span>
        )
      case 'cancelled':
        return (
          <span className="text-red-300">
            ❌ Auction cancelled
          </span>
        )
      default:
        return null
    }
  }

  const bgClass = {
    created: 'bg-stone-700/30 border border-stone-600/30',
    bid: 'bg-amber-900/30 border border-amber-700/30',
    chat: isOwn ? 'bg-stone-700/50' : 'bg-stone-800/50',
    settled: 'bg-green-900/30 border border-green-700/30',
    cancelled: 'bg-red-900/30 border border-red-700/30',
  }[type] || 'bg-stone-800/50'

  const isSystem = type === 'created' || type === 'settled' || type === 'cancelled'

  return (
    <div className={`flex items-start gap-1.5 text-[10px] ${isOwn && !isSystem ? 'flex-row-reverse' : ''}`}>
      <div className={`max-w-[80%] rounded px-1.5 py-1 ${bgClass} ${isSystem ? 'w-full text-center' : ''}`}>
        {!isOwn && !isSystem && (
          <div className="text-stone-500 text-[9px] font-mono mb-0.5">
            {shortenAddress(actor)}
          </div>
        )}
        <div>{renderContent()}</div>
        {txUrl && (
          <a 
            href={txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-green-400/70 hover:text-green-300 hover:underline mt-0.5 inline-block"
          >
            View tx ↗
          </a>
        )}
      </div>
    </div>
  )
}
