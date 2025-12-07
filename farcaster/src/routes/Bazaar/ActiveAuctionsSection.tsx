import { useState, useCallback } from 'react'
import { ActiveAuctions } from '../../components/ActiveAuctions'
import { CreateAuction } from '../../components/CreateAuction'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { NftDetailModal } from '../../components/NftDetailModal'
import type { AuctionPrefill } from '../../hooks/useCreateAuction'
import type { Nft } from '../../stores/nftStore'

interface ActiveAuctionsSectionProps {
  expanded: boolean
  onToggle: () => void
  onHelp: () => void
}

export function ActiveAuctionsSection({ expanded, onToggle, onHelp }: ActiveAuctionsSectionProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [auctionPrefill, setAuctionPrefill] = useState<AuctionPrefill | null>(null)
  const [detailNft, setDetailNft] = useState<Nft | null>(null)

  const handleCreateAuction = useCallback((prefill?: AuctionPrefill) => {
    setAuctionPrefill(prefill || null)
    setShowCreateForm(true)
  }, [])

  const handleClearPrefill = useCallback(() => {
    setAuctionPrefill(null)
  }, [])

  const handleShowNftDetails = useCallback(async (nftId: string) => {
    try {
      const res = await fetch(`/api/nft/${nftId}`)
      if (!res.ok) throw new Error('Failed to fetch NFT')
      const data = await res.json()
      setDetailNft(data.nft)
    } catch (err) {
      console.error('Failed to fetch NFT details:', err)
    }
  }, [])

  return (
    <>
      <CollapsibleSection
        title="Active Auctions"
        icon="🏛️"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={<span className="text-stone-400 text-[10px]">Browse and bid on artifacts</span>}
        action={
          <button
            onClick={() => handleCreateAuction()}
            className="w-16 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 text-white text-xs font-medium rounded transition-all text-center"
          >
            + Auction
          </button>
        }
      >
        <ActiveAuctions onShowNftDetails={handleShowNftDetails} />
      </CollapsibleSection>

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
