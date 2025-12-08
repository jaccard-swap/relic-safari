import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '@tanstack/react-store'
import { activeNfts, invalidateNfts } from '../../stores/nftStore'
import { useErc1155Faucet } from '../../hooks/useFaucet'
import { useFaucetBalances } from '../../hooks/useFaucetBalances'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { MiniNftCard } from './MiniNftCard'
import { NftDetailModal } from '../../components/NftDetailModal'
import { Toast } from '../../components/Toast'
import type { Nft } from '../../stores/nftStore'

interface QuarryProps {
  expanded: boolean
  onToggle: () => void
  onHelp: () => void
}

export function Quarry({ expanded, onToggle, onHelp }: QuarryProps) {
  const nfts = useStore(activeNfts)
  const [detailNft, setDetailNft] = useState<Nft | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastShown = useRef(false)

  const { refetchBalances, isConnected } = useFaucetBalances()

  const handleSuccess = useCallback(() => {
    refetchBalances()
    invalidateNfts()
  }, [refetchBalances])

  const {
    claimFaucetErc1155,
    isPending: digPending,
    isConfirmed: digConfirmed,
    error: digError
  } = useErc1155Faucet(handleSuccess)

  // Show toast on dig success
  useEffect(() => {
    if (digConfirmed && !toastShown.current) {
      toastShown.current = true
      setToast({ message: 'New artifact discovered! Check below ⛏️', type: 'success' })
    }
    if (!digConfirmed) {
      toastShown.current = false
    }
  }, [digConfirmed])

  // Show toast on any error
  useEffect(() => {
    if (digError) {
      setToast({ 
        message: digError.message || 'Excavation failed', 
        type: 'error' 
      })
    }
  }, [digError])

  return (
    <>
      <CollapsibleSection
        title="Quarry"
        icon="⛏️"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="text-stone-400 text-[10px]">{nfts.length} artifacts found</span>
            <span className="text-stone-500 text-[9px]">1/day</span>
          </>
        }
        action={
          <button
            onClick={claimFaucetErc1155}
            disabled={!isConnected || digPending}
            className="relative w-14 py-1.5 bg-gradient-to-r from-stone-600 to-amber-800 hover:from-stone-500 hover:to-amber-700 text-white text-xs font-medium rounded transition-all disabled:opacity-50 text-center"
          >
            {digPending ? '⏳' : digError ? '✗' : 'Dig'}
            {digConfirmed && <span className="absolute -top-1 -right-1 text-green-400 text-[10px]">✓</span>}
          </button>
        }
      >
        <div className="text-[9px] text-stone-500 mt-2 mb-1">Recent Finds</div>
        {nfts.length === 0 ? (
          <div className="text-[9px] text-stone-500 text-center py-2">No artifacts yet</div>
        ) : (
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {nfts.slice(0, 5).map((nft) => (
              <MiniNftCard 
                key={nft.id} 
                nft={nft} 
                onClick={() => setDetailNft(nft)}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      <NftDetailModal nft={detailNft} onClose={() => setDetailNft(null)} />
      
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
