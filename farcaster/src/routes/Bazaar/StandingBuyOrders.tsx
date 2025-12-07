import { useState, useCallback, useMemo, useEffect } from 'react'
import { useConnection } from 'wagmi'
import { computeMinHash } from '@shared/constants'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { useStandingBid } from '../../hooks/useStandingBid'
import { useStandingBids } from '../../hooks/useStandingBids'
import { TraitSelector } from './TraitSelector'
import { MinHashPreview } from './MinHashPreview'
import { StandingBidCard } from './StandingBidCard'
import { Toast } from '../../components/Toast'

interface StandingBuyOrdersProps {
  expanded: boolean
  onToggle: () => void
  onHelp: () => void
}

export function StandingBuyOrders({ expanded, onToggle, onHelp }: StandingBuyOrdersProps) {
  const { address } = useConnection()
  
  // Buy order builder state
  const [selectedTraits, setSelectedTraits] = useState<Record<string, string>>({})
  const [minMatches, setMinMatches] = useState(3)
  const [bidAmount, setBidAmount] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // Standing bid hooks
  const { createStandingBid, isPending: bidPending, error: bidError, success: bidSuccess, reset: resetBid } = useStandingBid()
  const { bids: standingBids, loading: bidsLoading, refetch: refetchBids } = useStandingBids()
  
  // Compute MinHash from selected traits
  const computedMinHash = useMemo(() => 
    computeMinHash(selectedTraits), 
    [selectedTraits]
  )
  
  const handleAddTrait = useCallback((key: string, value: string) => {
    setSelectedTraits(prev => ({ ...prev, [key]: value }))
  }, [])
  
  const handleRemoveTrait = useCallback((key: string) => {
    setSelectedTraits(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])
  
  const handleCreateBuyOrder = useCallback(async () => {
    if (!computedMinHash || Object.keys(selectedTraits).length === 0 || !bidAmount) return
    
    const result = await createStandingBid({
      amount: bidAmount,
      targetMinHash: computedMinHash,
      minMatches,
      desiredTraits: selectedTraits,
    })
    
    if (result) {
      setSelectedTraits({})
      setBidAmount('')
      refetchBids()
      setToast({ message: 'Buy order created!', type: 'success' })
    }
  }, [computedMinHash, selectedTraits, bidAmount, minMatches, createStandingBid, refetchBids])
  
  // Reset error/success states when traits change
  useEffect(() => {
    resetBid()
  }, [selectedTraits, bidAmount, resetBid])
  
  const canCreateBuyOrder = address && Object.keys(selectedTraits).length > 0 && bidAmount && !bidPending

  return (
    <>
      <CollapsibleSection
        title="Standing Buy Orders"
        icon="📋"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="text-stone-400 text-[10px]">Create bids for trait-matched artifacts</span>
            {!address && <span className="text-[9px] text-stone-500">Connect wallet</span>}
          </>
        }
      >
        {/* Trait Builder */}
        <div className="mt-2 p-2 rounded-lg bg-gradient-to-br from-stone-900 via-amber-950/10 to-stone-900 border border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-400 font-semibold">
              ◈ TRAIT MATCHER
            </span>
            {Object.keys(selectedTraits).length > 0 && (
              <button 
                onClick={() => setSelectedTraits({})}
                className="text-[8px] text-stone-500 hover:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
          
          <TraitSelector 
            selectedTraits={selectedTraits}
            onAddTrait={handleAddTrait}
            onRemoveTrait={handleRemoveTrait}
          />
          
          {/* MinHash Preview */}
          {Object.keys(selectedTraits).length > 0 && (
            <div className="mt-2 pt-2 border-t border-stone-700/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] text-stone-500">Generated MinHash</span>
                <MinHashPreview minHash={computedMinHash} />
              </div>
              
              {/* Similarity threshold */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] text-stone-400">Match threshold</span>
                <div className="flex items-center gap-1">
                  {[2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setMinMatches(n)}
                      className={`w-5 h-5 text-[9px] rounded ${
                        minMatches === n 
                          ? 'bg-amber-600 text-white' 
                          : 'bg-stone-700 text-stone-400 hover:bg-stone-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <span className="text-[8px] text-stone-500 ml-1">/5</span>
                </div>
              </div>
              
              {/* Bid amount */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder="Bid amount"
                  className="flex-1 px-2 py-1 bg-stone-900/50 border border-stone-700 rounded text-[10px] text-white placeholder-stone-500 focus:outline-none focus:border-amber-700"
                />
                <span className="text-[9px] text-stone-500">SCRIP</span>
              </div>
              
              {/* Create button */}
              <button
                onClick={handleCreateBuyOrder}
                disabled={!canCreateBuyOrder}
                className={`w-full mt-2 py-1.5 text-xs font-medium rounded transition-all ${
                  canCreateBuyOrder
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 text-white'
                    : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                }`}
              >
                {bidPending ? '✍️ Signing...' : bidSuccess ? '✓ Created!' : 'Create Buy Order'}
              </button>
              
              {bidError && (
                <div className="text-[8px] text-red-400 text-center mt-1">
                  ⚠️ {bidError}
                </div>
              )}
              
              <div className="text-[8px] text-stone-500 text-center mt-1">
                Will match any artifact with {minMatches}/5 MinHash bands
              </div>
            </div>
          )}
        </div>
        
        {/* Existing buy orders */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-stone-500">Your Buy Orders</span>
            <span className="text-[9px] text-amber-300">{standingBids.length} active</span>
          </div>
          {bidsLoading ? (
            <div className="text-[9px] text-stone-500 text-center py-2 animate-pulse">
              Loading...
            </div>
          ) : standingBids.length === 0 ? (
            <div className="text-[9px] text-stone-500 text-center py-2">
              No standing buy orders yet
            </div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {standingBids.map((bid) => (
                <StandingBidCard key={bid.id} bid={bid} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={4000}
          onClose={() => setToast(null)}
        />
      )}
    </>
  )
}

