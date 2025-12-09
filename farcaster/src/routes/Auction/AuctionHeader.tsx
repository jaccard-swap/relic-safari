import { formatEther } from 'viem'
import type { Chain } from 'viem'
import { shortenAddress } from './utils'
import type { Auction } from '../../hooks/useActiveAuctions'
import type { Nft, NftMetadata } from '../../stores/nftStore'
import { getExplorerUrl } from '../../utils/explorer'
import { 
  FORM_EMOJI, 
  QUALITY_EMOJI,
  INSCRIPTION_EMOJI,
  AGE_STYLES,
  MATERIAL_STYLES,
  SITE_STYLES,
  RARITY_EMOJI,
} from '../../utils/artifactStyles'

interface AuctionHeaderProps {
  auction: Auction
  nftData: Nft | null
  highBid: string
  timeLeft: string
  isEnded: boolean
  isAuctioneer: boolean
  connected: boolean
  participantCount: number
  chain?: Chain
  onShowArtifact: () => void
  onShowAuctionInfo: () => void
}

export function AuctionHeader({
  auction,
  nftData,
  highBid,
  timeLeft,
  isEnded,
  isAuctioneer,
  connected,
  participantCount,
  chain,
  onShowArtifact,
  onShowAuctionInfo,
}: AuctionHeaderProps) {
  const metadata = nftData?.metadata as NftMetadata | undefined
  const auctioneerUrl = chain ? getExplorerUrl(chain, auction.auctioneer, 'address') : null
  const form = metadata?.form as string
  const rarity = metadata?.rarity as string
  const age = metadata?.age as string
  const material = metadata?.material as string
  const quality = metadata?.quality as string
  const inscription = metadata?.inscription as string
  const site = metadata?.site as string

  return (
    <div className="bg-stone-800/50 border border-amber-900/30 rounded-lg p-2">
      {/* Artifact card */}
      <div className="relative bg-black/20 rounded p-1.5 mb-2">
        <button 
          onClick={onShowArtifact}
          className="absolute top-1 right-1 text-[9px] text-stone-500 hover:text-amber-300 transition-colors"
        >
          ?
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 flex items-center justify-center bg-black/30 rounded text-lg">
            {form ? FORM_EMOJI[form] || '⚱️' : '⚱️'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-amber-200 truncate pr-4">{auction.title}</h1>
            <div className="flex items-center gap-2 text-[10px]">
              {auctioneerUrl ? (
                <a 
                  href={auctioneerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-400 font-mono hover:text-amber-300 hover:underline"
                >
                  {shortenAddress(auction.auctioneer)}
                </a>
              ) : (
              <span className="text-stone-400 font-mono">{shortenAddress(auction.auctioneer)}</span>
              )}
              {isAuctioneer && <span className="px-1 bg-amber-700/50 text-amber-200 rounded">you</span>}
            </div>
          </div>
        </div>
        
        {/* Trait emojis */}
        {metadata && (
          <div className="flex items-center gap-1.5 mt-1.5 justify-end text-[10px]">
            {rarity && <span title={rarity}>{RARITY_EMOJI[rarity]}</span>}
            {age && <span title={age}>{AGE_STYLES[age]?.emoji}</span>}
            {material && <span title={material}>{MATERIAL_STYLES[material]?.emoji}</span>}
            {quality && <span title={quality}>{QUALITY_EMOJI[quality]}</span>}
            {inscription && inscription !== 'unmarked' && <span title={inscription}>{INSCRIPTION_EMOJI[inscription]}</span>}
            {site && <span title={site}>{SITE_STYLES[site]?.emoji}</span>}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between text-[9px] mb-2">
        <div className="flex items-center gap-2">
          {participantCount > 0 && <span className="text-stone-500">👥 {participantCount}</span>}
          <div className={`px-1.5 py-0.5 rounded ${connected ? 'bg-green-900/50 text-green-400' : 'bg-amber-900/50 text-amber-400'}`}>
            {connected ? '● Live' : '○ ...'}
          </div>
        </div>
        <button 
          onClick={onShowAuctionInfo}
          className="text-stone-500 hover:text-amber-300 transition-colors"
        >
          How it works?
        </button>
      </div>
      
      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] pt-2 border-t border-stone-700/50">
        <div>
          <span className="text-stone-500">Token</span>
          <div className="text-stone-300 font-mono">#{auction.nftTokenId.length > 8 ? `${auction.nftTokenId.slice(0, 4)}...${auction.nftTokenId.slice(-4)}` : auction.nftTokenId}</div>
        </div>
        <div className="text-center">
          <span className="text-stone-500">High Bid</span>
          <div className="text-amber-300 font-medium">{formatEther(BigInt(highBid))} SCRIP</div>
        </div>
        <div className="text-right">
          <span className="text-stone-500">Time</span>
          <div className={isEnded ? 'text-red-400' : 'text-green-400'}>{timeLeft}</div>
        </div>
      </div>
    </div>
  )
}
