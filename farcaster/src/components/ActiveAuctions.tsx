import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useChains } from 'wagmi'
import { useActiveAuctions, type Auction } from '../hooks/useActiveAuctions'
import { formatEther, type Chain } from 'viem'
import { getExplorerUrl } from '../utils/explorer'

function formatTimeLeft(endTime: string): string {
  const end = new Date(endTime).getTime()
  const now = Date.now()
  const diff = end - now

  if (diff <= 0) return 'Ended'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h ${mins}m`
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

interface AuctionCardProps {
  auction: Auction
  isExpanded: boolean
  onToggle: () => void
  onShowNftDetails?: (nftId: string) => void
  chain?: Chain
}

function AuctionCard({ auction, isExpanded, onToggle, onShowNftDetails, chain }: AuctionCardProps) {
  const timeLeft = formatTimeLeft(auction.endTime)
  const isEnded = timeLeft === 'Ended'
  const bidDisplay = formatEther(BigInt(auction.startingBid))
  const auctioneerUrl = chain ? getExplorerUrl(chain, auction.auctioneer, 'address') : null

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Card header - clickable */}
      <div
        onClick={onToggle}
        className={`w-full flex items-center gap-2 p-1.5 bg-stone-900/50 border border-amber-900/30 hover:border-amber-700/50 transition-all min-w-0 text-left cursor-pointer ${
          isExpanded ? 'rounded-t-lg border-b-0' : 'rounded-lg'
        }`}
      >
        {/* Artifact icon */}
        <div className="w-6 h-6 flex items-center justify-center bg-amber-900/40 rounded text-sm shrink-0">
          ⚱️
        </div>
        
        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium text-amber-200 truncate">
            {auction.title}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-stone-400">{bidDisplay} SCRIP</span>
            <span className={`text-[9px] ${isEnded ? 'text-red-400' : 'text-emerald-400'}`}>
              • {timeLeft}
            </span>
          </div>
        </div>
        
        {/* NFT details button */}
        {auction.nftId && onShowNftDetails && (
          <button 
            onClick={(e) => { e.stopPropagation(); onShowNftDetails(auction.nftId!) }}
            className="text-[9px] text-white/30 hover:text-amber-300 shrink-0 px-1"
          >
            ?
          </button>
        )}

        {/* Chain badge */}
        <div className="text-[8px] text-stone-500 bg-stone-800/50 px-1 py-0.5 rounded shrink-0">
          {auction.chainId === 84532 ? 'Base' : 'Sep'}
        </div>

        {/* Expand indicator */}
        <svg 
          className={`w-3 h-3 text-stone-500 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expandable details panel */}
      <div 
        className={`grid transition-all duration-200 ease-out ${
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="p-2 bg-stone-900/30 border border-t-0 border-amber-900/30 rounded-b-lg space-y-2">
            {/* Details */}
            <div className="text-[9px] text-stone-500 space-y-0.5">
              <div className="flex justify-between">
                <span>Curator</span>
                {auctioneerUrl ? (
                  <a 
                    href={auctioneerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-stone-300 hover:text-amber-300 hover:underline"
                  >
                    {shortenAddress(auction.auctioneer)}
                  </a>
                ) : (
                  <span className="text-stone-300">{shortenAddress(auction.auctioneer)}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span>Relic</span>
                <span className="text-stone-300">#{auction.nftTokenId.slice(-6)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ends</span>
                <span className="text-stone-300">{new Date(auction.endTime).toLocaleString()}</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-1">
              <Link
                to="/auction/$auctionId"
                params={{ auctionId: auction.id }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 py-1 bg-gradient-to-r from-amber-700 to-yellow-800 hover:from-amber-600 hover:to-yellow-700 text-white text-[9px] font-medium rounded transition-all text-center"
              >
                🏛️ Enter
              </Link>
              <Link
                to="/auction/$auctionId"
                params={{ auctionId: auction.id }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 py-1 bg-stone-700/80 hover:bg-stone-600 text-white text-[9px] font-medium rounded transition-colors text-center"
              >
                📋 Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActiveAuctionsProps {
  onShowNftDetails?: (nftId: string) => void
}

export function ActiveAuctions({ onShowNftDetails }: ActiveAuctionsProps) {
  const { auctions, loading, error, refetch } = useActiveAuctions()
  const chains = useChains()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  if (loading) {
    return (
      <div className="py-3 text-center">
        <div className="text-[10px] text-stone-500 animate-pulse">Scanning the exchange...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-2 text-center">
        <div className="text-[10px] text-red-400">{error}</div>
        <button 
          onClick={refetch}
          className="text-[9px] text-stone-500 hover:text-amber-300 underline mt-1"
        >
          Retry
        </button>
      </div>
    )
  }

  if (auctions.length === 0) {
    return (
      <div className="py-3 text-center">
        <div className="text-[10px] text-stone-500">No relics on offer</div>
        <div className="text-[9px] text-stone-600 mt-0.5">
          Auction an artifact to start!
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] text-stone-500">Relic Exchange</span>
        <span className="text-[9px] text-amber-300">{auctions.length} on offer</span>
      </div>
      
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {auctions.map((auction) => (
          <AuctionCard 
            key={auction.id} 
            auction={auction} 
            isExpanded={expandedId === auction.id}
            onToggle={() => toggleExpand(auction.id)}
            onShowNftDetails={onShowNftDetails}
            chain={chains.find(c => c.id === auction.chainId)}
          />
        ))}
      </div>
    </div>
  )
}
