import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useConnection, useChainId, useChains } from 'wagmi'
import { useStore } from '@tanstack/react-store'
import { activeNfts, invalidateNfts } from '../../stores/nftStore'
import { useFaucetBalances } from '../../hooks/useFaucetBalances'
import { usePolymeraseSimulation } from '../../hooks/usePolymeraseSimulation'
import { usePolymerizationHistory, type PolymerizationRecord } from '../../hooks/usePolymerizationHistory'
import { authFetch } from '../../lib/auth'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { MiniNftCard } from './MiniNftCard'
import { WorkbenchArtifact } from './WorkbenchArtifact'
import { SimulationPanel } from './SimulationPanel'
import { ReactionCard } from './ReactionCard'
import { ReactionDetailModal } from './ReactionDetailModal'
import { Toast } from '../../components/Toast'

interface PolymeraseProps {
  expanded: boolean
  onToggle: () => void
  onHelp: () => void
  onReactionsHelp: () => void
}

export function Polymerase({ expanded, onToggle, onHelp, onReactionsHelp }: PolymeraseProps) {
  const nfts = useStore(activeNfts)
  const [selectedNfts, setSelectedNfts] = useState<string[]>([])
  const [fusePending, setFusePending] = useState(false)
  const [fuseSuccess, setFuseSuccess] = useState(false)
  const [fuseError, setFuseError] = useState<string | null>(null)
  const [detailReaction, setDetailReaction] = useState<PolymerizationRecord | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const { address } = useConnection()
  const chainId = useChainId()
  const chains = useChains()
  const { essenceBalance, refetchBalances } = useFaucetBalances()
  const { history: reactions, loading: reactionsLoading, refetch: refetchReactions } = usePolymerizationHistory()

  const targetNftId = selectedNfts[0] || null
  const consumedNftId = selectedNfts[1] || null
  
  const targetNft = useMemo(() => nfts.find(n => n.id === targetNftId), [nfts, targetNftId])
  const consumedNft = useMemo(() => nfts.find(n => n.id === consumedNftId), [nfts, consumedNftId])
  
  const { simulation, loading: simLoading, error: simError } = usePolymeraseSimulation(targetNftId, consumedNftId)

  const toggleNftSelection = (id: string) => {
    setSelectedNfts(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id)
      }
      if (prev.length >= 2) {
        return [prev[1], id]
      }
      return [...prev, id]
    })
  }

  const clearSelection = () => {
    setSelectedNfts([])
    setFuseSuccess(false)
    setFuseError(null)
  }

  const swapSelection = () => {
    if (selectedNfts.length === 2) {
      setSelectedNfts([selectedNfts[1], selectedNfts[0]])
    }
  }

  // Track expected essence for polling
  const [expectedEssenceYield, setExpectedEssenceYield] = useState<number | null>(null)
  const oldEssenceRef = useRef<number>(0)
  
  // Poll for essence balance change after fusion
  useEffect(() => {
    if (expectedEssenceYield === null) return
    
    let attempts = 0
    const maxAttempts = 10
    
    const poll = () => {
      attempts++
      refetchBalances()
      
      const currentEssence = essenceBalance?.count ?? 0
      if (currentEssence !== oldEssenceRef.current || attempts >= maxAttempts) {
        setExpectedEssenceYield(null)
        return
      }
      
      setTimeout(poll, 500)
    }
    
    setTimeout(poll, 500)
  }, [expectedEssenceYield, essenceBalance?.count, refetchBalances])

  const handleFuse = useCallback(async () => {
    if (!targetNft || !consumedNft || !address || simulation?.eligible !== true) return
    
    setFusePending(true)
    setFuseError(null)
    setFuseSuccess(false)
    
    oldEssenceRef.current = essenceBalance?.count ?? 0
    
    try {
      const res = await authFetch('/api/faucet/polymerase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: address,
          targetTokenId: targetNft.tokenId,
          consumedTokenId: consumedNft.tokenId,
          chainId,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Fusion failed')
      }
      
      setFuseSuccess(true)
      invalidateNfts()
      refetchReactions()
      
      const essenceMsg = data.essenceYield > 0 ? ` +${data.essenceYield} ✨` : ''
      setToast({ message: `Fusion complete!${essenceMsg}`, type: 'success' })
      
      setExpectedEssenceYield(data.essenceYield ?? 1)
      
      setTimeout(() => {
        clearSelection()
      }, 2000)
    } catch (err) {
      console.error('Fusion failed:', err)
      setFuseError((err as Error).message)
      setToast({ message: `Fusion failed: ${(err as Error).message}`, type: 'error' })
    } finally {
      setFusePending(false)
    }
  }, [targetNft, consumedNft, address, chainId, simulation?.eligible, essenceBalance?.count, refetchReactions])

  const canFuse = selectedNfts.length === 2 && simulation?.eligible === true && !fusePending

  return (
    <>
      <CollapsibleSection
        title="Polymerase"
        icon="⚗️"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="text-purple-300 font-mono text-sm">{essenceBalance?.count ?? 0}</span>
            <span className="text-stone-500 text-[9px]">✨ Essence</span>
          </>
        }
        action={
          <button 
            onClick={handleFuse}
            disabled={!canFuse}
            className={`relative w-14 py-1.5 text-xs font-medium rounded text-center transition-all ${
              canFuse 
                ? 'bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 text-white'
                : 'bg-stone-700 text-stone-400 cursor-not-allowed'
            }`}
          >
            {fusePending ? '⏳' : fuseError ? '✗' : 'Fuse'}
            {fuseSuccess && <span className="absolute -top-1 -right-1 text-green-400 text-[10px]">✓</span>}
          </button>
        }
      >
        {/* Workbench - show when at least one selected */}
        {targetNft && (
          <div className="mt-2 p-2 rounded-lg bg-gradient-to-br from-stone-900 via-purple-950/20 to-stone-900 border border-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 font-semibold">
                ◈ FUSION WORKBENCH
              </span>
              <button 
                onClick={clearSelection}
                className="text-[8px] text-stone-500 hover:text-red-400"
              >
                Clear
              </button>
            </div>

            {consumedNft ? (
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <WorkbenchArtifact nft={targetNft} role="target" />
                </div>
                <button
                  onClick={swapSelection}
                  className="p-1.5 rounded bg-purple-900/30 hover:bg-purple-800/50 border border-purple-700/30 text-purple-300 hover:text-purple-200 transition-colors"
                  title="Swap target and catalyst"
                >
                  ⇄
                </button>
                <div className="flex-1">
                  <WorkbenchArtifact nft={consumedNft} role="consumed" />
                </div>
              </div>
            ) : (
              <div className="max-w-[180px] mx-auto">
                <WorkbenchArtifact nft={targetNft} role="target" />
              </div>
            )}

            {consumedNft && (
              <div className="mt-2 pt-2 border-t border-purple-500/20">
                <SimulationPanel simulation={simulation} loading={simLoading} error={simError} />
              </div>
            )}

            {fuseSuccess && (
              <div className="mt-2 p-2 rounded border border-emerald-500/50 bg-emerald-950/40 text-center">
                <div className="text-emerald-400 text-sm">✨ Fusion Complete!</div>
                <div className="text-[9px] text-stone-400">Artifact upgraded successfully</div>
              </div>
            )}
            {fuseError && (
              <div className="mt-2 p-2 rounded border border-red-500/50 bg-red-950/40 text-center">
                <div className="text-red-400 text-[10px]">⚠️ {fuseError}</div>
              </div>
            )}
            {fusePending && (
              <div className="mt-2 p-2 rounded border border-purple-500/50 bg-purple-950/40 text-center">
                <div className="text-purple-400 text-sm animate-pulse">⚗️ Fusing...</div>
                <div className="text-[9px] text-stone-400">Waiting for confirmation</div>
              </div>
            )}

            {!consumedNft && (
              <div className="mt-2 text-center text-[9px] text-purple-300/70">
                Select catalyst artifact below ↓
              </div>
            )}
          </div>
        )}

        {/* NFT Selection list */}
        <div className="flex items-center justify-between mt-2 mb-1">
          <span className="text-[9px] text-stone-500">
            {!targetNft ? 'Select target artifact' : !consumedNft ? 'Select catalyst' : 'Selected'}
          </span>
          <span className="text-[9px] text-amber-300">{selectedNfts.length}/2</span>
        </div>
        {nfts.length < 2 ? (
          <div className="text-[9px] text-stone-500 text-center py-2">Need at least 2 artifacts</div>
        ) : (
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {nfts.map((nft) => {
              const isTarget = nft.id === targetNftId
              const isConsumed = nft.id === consumedNftId
              return (
                <MiniNftCard 
                  key={nft.id} 
                  nft={nft} 
                  selected={isTarget || isConsumed}
                  role={isTarget ? 'target' : isConsumed ? 'consumed' : undefined}
                  onSelect={() => toggleNftSelection(nft.id)}
                />
              )
            })}
          </div>
        )}

        {/* Recent Reactions - inline */}
        <div className="mt-3 pt-2 border-t border-purple-500/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-purple-300 font-medium">🧪 Recent Reactions</span>
            <button 
              onClick={onReactionsHelp}
              className="text-stone-500 hover:text-purple-300 text-[10px]"
            >
              ?
            </button>
          </div>
          {reactionsLoading ? (
            <div className="text-[9px] text-stone-500 text-center py-2 animate-pulse">Loading...</div>
          ) : reactions.length === 0 ? (
            <div className="text-[9px] text-stone-500 text-center py-2">No fusions yet</div>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {reactions.map((reaction) => (
                <ReactionCard 
                  key={reaction.id} 
                  reaction={reaction} 
                  onClick={() => setDetailReaction(reaction)}
                />
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <ReactionDetailModal 
        reaction={detailReaction} 
        onClose={() => setDetailReaction(null)}
        chain={chains.find(c => c.id === chainId)}
      />

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
