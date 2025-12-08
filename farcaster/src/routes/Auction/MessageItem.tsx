import { formatEther } from 'viem'
import type { Chain } from 'viem'
import { shortenAddress } from './utils'
import { getExplorerUrl } from '../../utils/explorer'
import type { ChatMessage } from '../../hooks/useAuctionRoom'

interface MessageItemProps {
  msg: ChatMessage
  isOwn: boolean
  chain?: Chain
}

export function MessageItem({ msg, isOwn, chain }: MessageItemProps) {
  const isBid = msg.type === 'bid'
  const isSettled = msg.type === 'settled'

  const txUrl = isSettled && msg.txHash && chain 
    ? getExplorerUrl(chain, msg.txHash, 'transaction') 
    : null

  return (
    <div className={`flex items-start gap-1.5 text-[10px] ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div className={`max-w-[80%] rounded px-1.5 py-1 ${
        isSettled
          ? 'bg-green-900/30 border border-green-700/30 w-full text-center'
          : isBid 
            ? 'bg-amber-900/30 border border-amber-700/30' 
            : isOwn 
              ? 'bg-stone-700/50' 
              : 'bg-stone-800/50'
      }`}>
        {!isOwn && !isSettled && (
          <div className="text-stone-500 text-[9px] font-mono mb-0.5">
            {shortenAddress(msg.user)}
          </div>
        )}
        <div className={isSettled ? 'text-green-300' : isBid ? 'text-amber-300' : 'text-stone-300'}>
          {isBid ? `💰 ${formatEther(BigInt(msg.message))} SCRIP` : msg.message}
        </div>
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
