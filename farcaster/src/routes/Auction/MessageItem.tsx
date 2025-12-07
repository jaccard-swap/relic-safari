import { formatEther } from 'viem'
import { shortenAddress } from './utils'
import type { ChatMessage } from '../../hooks/useAuctionRoom'

interface MessageItemProps {
  msg: ChatMessage
  isOwn: boolean
}

export function MessageItem({ msg, isOwn }: MessageItemProps) {
  const isBid = msg.type === 'bid'

  return (
    <div className={`flex items-start gap-1.5 text-[10px] ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div className={`max-w-[80%] rounded px-1.5 py-1 ${
        isBid 
          ? 'bg-amber-900/30 border border-amber-700/30' 
          : isOwn 
            ? 'bg-stone-700/50' 
            : 'bg-stone-800/50'
      }`}>
        {!isOwn && (
          <div className="text-stone-500 text-[9px] font-mono mb-0.5">
            {shortenAddress(msg.user)}
          </div>
        )}
        <div className={isBid ? 'text-amber-300' : 'text-stone-300'}>
          {isBid ? `💰 ${formatEther(BigInt(msg.message))} SCRIP` : msg.message}
        </div>
      </div>
    </div>
  )
}
