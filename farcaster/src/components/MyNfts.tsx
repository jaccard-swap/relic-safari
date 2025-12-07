import { useState } from 'react'
import { useMyNfts, type Nft, type NftMetadata } from '../hooks/useMyNfts'
import { CreateAuction } from './CreateAuction'
import { NftDetailModal } from './NftDetailModal'
import type { AuctionPrefill } from '../hooks/useCreateAuction'
import { 
  FORM_EMOJI, 
  QUALITY_BADGE, 
  QUALITY_EMOJI,
  INSCRIPTION_STYLES,
  INSCRIPTION_EMOJI,
  AGE_STYLES,
  MATERIAL_STYLES,
  SITE_STYLES,
  RARITY_EMOJI,
  getCardStyles, 
  getNameStyles 
} from '../utils/artifactStyles'

export type { Nft, NftMetadata }

interface NftCardProps {
  nft: Nft
  isExpanded: boolean
  onToggle: () => void
  onAuction?: (prefill: AuctionPrefill) => void
  onShowDetails: () => void
}

function NftCard({ nft, isExpanded, onToggle, onAuction, onShowDetails }: NftCardProps) {
  const metadata = nft.metadata as NftMetadata
  const rarity = metadata.rarity as string || 'common'
  const form = metadata.form as string
  const quality = metadata.quality as string
  const inscription = metadata.inscription as string
  const age = metadata.age as string
  const material = metadata.material as string
  const site = metadata.site as string

  const handleAuction = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAuction?.({
      nftContract: nft.contractAddress,
      nftTokenId: nft.tokenId,
      nftId: nft.id,
      title: metadata.name || `Artifact #${nft.tokenId.slice(-6)}`,
    })
  }

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    onShowDetails()
  }

  const cardStyles = getCardStyles(rarity)
  const nameStyles = getNameStyles(rarity)

  return (
    <div className="rounded overflow-hidden">
      {/* Card header */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-1.5 p-1.5 border transition-all text-left ${cardStyles} ${
          isExpanded ? 'rounded-t border-b-0' : 'rounded'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center bg-black/30 rounded text-sm shrink-0">
          {form ? FORM_EMOJI[form] || '⚱️' : '⚱️'}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] truncate ${nameStyles}`}>
            {RARITY_EMOJI[rarity] || ''} {metadata.name || `#${nft.tokenId.slice(-6)}`}
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-[8px]">
            {age && <span title={age}>{AGE_STYLES[age]?.emoji || '📅'}</span>}
            {material && <span title={material}>{MATERIAL_STYLES[material]?.emoji || '🪨'}</span>}
            {quality && <span title={quality}>{QUALITY_EMOJI[quality] || ''}</span>}
            {inscription && inscription !== 'unmarked' && <span title={inscription}>{INSCRIPTION_EMOJI[inscription] || ''}</span>}
            {site && <span title={site}>{SITE_STYLES[site]?.emoji || '📍'}</span>}
          </div>
        </div>

        <span onClick={handleDetails} role="button" className="text-[9px] text-white/30 hover:text-amber-300 shrink-0 px-1 cursor-pointer">?</span>
        <div className="text-[7px] text-white/30 shrink-0">{nft.chainId === 84532 ? 'B' : 'S'}</div>
        <svg className={`w-2.5 h-2.5 text-white/30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable panel */}
      <div className={`grid transition-all duration-200 ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <div className={`p-1.5 border border-t-0 rounded-b ${cardStyles}`}>
            <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 mb-1.5 text-[8px] text-white/50">
              {age && <span>{AGE_STYLES[age]?.emoji} <span className={AGE_STYLES[age]?.style}>{age}</span></span>}
              {material && <span>{MATERIAL_STYLES[material]?.emoji} <span className={MATERIAL_STYLES[material]?.style}>{material}</span></span>}
              {quality && <span>{QUALITY_EMOJI[quality]} <span className={QUALITY_BADGE[quality]}>{quality}</span></span>}
              {inscription && <span>{INSCRIPTION_EMOJI[inscription]} <span className={INSCRIPTION_STYLES[inscription]}>{inscription}</span></span>}
              {site && <span>{SITE_STYLES[site]?.emoji} <span className={SITE_STYLES[site]?.style}>{site.replace('-', ' ')}</span></span>}
              <span>{RARITY_EMOJI[rarity]} <span className={nameStyles}>{rarity}</span></span>
            </div>
            
            <div className="flex gap-1">
              <button onClick={handleAuction} className="flex-1 py-1 bg-amber-700/80 hover:bg-amber-600 text-white text-[9px] font-medium rounded transition-colors">
                🏛️ Auction
              </button>
              <button className="flex-1 py-1 bg-stone-600/80 hover:bg-stone-500 text-white text-[9px] font-medium rounded transition-colors">
                ⚗️ Fuse
              </button>
              <button className="flex-1 py-1 bg-stone-700/80 hover:bg-stone-600 text-white text-[9px] font-medium rounded transition-colors">
                ↗ Gift
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MyNfts() {
  const { nfts, loading, error, refetch } = useMyNfts()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [auctionPrefill, setAuctionPrefill] = useState<AuctionPrefill | null>(null)
  const [detailNft, setDetailNft] = useState<Nft | null>(null)

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id)

  const handleAuction = (prefill: AuctionPrefill) => {
    setAuctionPrefill(prefill)
    setShowCreateForm(true)
  }

  const handleClearPrefill = () => setAuctionPrefill(null)

  if (loading) {
    return <div className="p-2 bg-stone-800/30 rounded text-[10px] text-stone-400 text-center">Cataloguing artifacts...</div>
  }

  if (error) {
    return (
      <div className="p-2 bg-red-900/20 rounded text-center">
        <div className="text-[10px] text-red-400">{error}</div>
        <button onClick={refetch} className="text-[9px] text-stone-400 hover:text-white underline mt-1">Retry</button>
      </div>
    )
  }

  if (nfts.length === 0) {
    return (
      <div className="p-2 bg-stone-800/30 rounded border border-stone-700/50 text-center">
        <div className="text-[10px] text-stone-400">No artifacts yet</div>
        <div className="text-[9px] text-stone-500 mt-0.5">Visit Excavation to uncover relics</div>
      </div>
    )
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-medium text-stone-400">Artifacts</span>
          <span className="text-[9px] text-stone-500">{nfts.length} recovered</span>
        </div>
        
        <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-700">
          {nfts.map((nft) => (
            <NftCard 
              key={nft.id} 
              nft={nft} 
              isExpanded={expandedId === nft.id}
              onToggle={() => toggleExpand(nft.id)}
              onAuction={handleAuction}
              onShowDetails={() => setDetailNft(nft)}
            />
          ))}
        </div>
      </div>

      <CreateAuction
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        prefill={auctionPrefill}
        onClearPrefill={handleClearPrefill}
      />

      <NftDetailModal 
        nft={detailNft} 
        onClose={() => setDetailNft(null)} 
      />
    </>
  )
}
