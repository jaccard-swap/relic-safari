import { useState } from 'react'
import { InfoModal } from '../../components/InfoModal'
import { ActiveAuctionsSection } from './ActiveAuctionsSection'
import { StandingBuyOrders } from './StandingBuyOrders'

export function Bazaar() {
  // Expandable sections
  const [auctionsExpanded, setAuctionsExpanded] = useState(true)
  const [buyOrdersExpanded, setBuyOrdersExpanded] = useState(false)
  
  // Info modals
  const [auctionsModal, setAuctionsModal] = useState(false)
  const [buyOrdersModal, setBuyOrdersModal] = useState(false)

  return (
    <div className="p-3 space-y-2">
      
      {/* Active Auctions */}
      <ActiveAuctionsSection
        expanded={auctionsExpanded}
        onToggle={() => setAuctionsExpanded(!auctionsExpanded)}
        onHelp={() => setAuctionsModal(true)}
      />

      {/* Standing Buy Orders */}
      <StandingBuyOrders
        expanded={buyOrdersExpanded}
        onToggle={() => setBuyOrdersExpanded(!buyOrdersExpanded)}
        onHelp={() => setBuyOrdersModal(true)}
      />
      
      {/* Info Modals */}
      <InfoModal open={auctionsModal} onClose={() => setAuctionsModal(false)} title="Active Auctions" icon="🏛️">
        <p>Browse artifacts being auctioned by other explorers.</p>
        <p>Place bids using your <strong className="text-amber-300">SCRIP</strong> tokens.</p>
        <p>Highest bidder wins when the auctioneer settles.</p>
        <p className="text-stone-500 text-xs">Technical: EIP-712 signed bids, no pre-approval needed.</p>
      </InfoModal>

      <InfoModal open={buyOrdersModal} onClose={() => setBuyOrdersModal(false)} title="Standing Buy Orders" icon="📋">
        <p>Create <strong className="text-amber-300">trait-based buy orders</strong> that match artifacts by similarity.</p>
        <p>Select desired traits → generate MinHash → set match threshold.</p>
        <p>Your bid will match any auction whose artifact shares enough bands.</p>
        <p className="text-stone-500 text-xs">Technical: Jaccard similarity via LSH MinHash.</p>
      </InfoModal>
    </div>
  )
}
