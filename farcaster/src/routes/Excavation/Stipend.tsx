import { useState, useCallback, useEffect, useRef } from 'react'
import { useChains } from 'wagmi'
import { useErc20Faucet } from '../../hooks/useFaucet'
import { useFaucetBalances } from '../../hooks/useFaucetBalances'
import { useFaucetHistory } from '../../hooks/useFaucetHistory'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { Toast } from '../../components/Toast'
import { getExplorerUrl } from '../../utils/explorer'

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface StipendProps {
  expanded: boolean
  onToggle: () => void
  onHelp: () => void
}

export function Stipend({ expanded, onToggle, onHelp }: StipendProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastShown = useRef(false)
  const chains = useChains()

  const { tokenBalance, refetchBalances, isConnected } = useFaucetBalances()
  const { history, recordClaim } = useFaucetHistory()

  const handleSuccess = useCallback(() => {
    refetchBalances()
  }, [refetchBalances])

  const {
    claimFaucetErc20,
    hash: claimHash,
    isPending: claimPending,
    isConfirming: claimConfirming,
    isConfirmed: claimConfirmed,
    error: claimError
  } = useErc20Faucet(handleSuccess)

  // Show toast and record claim on success
  useEffect(() => {
    if (claimConfirmed && claimHash && !toastShown.current) {
      toastShown.current = true
      setToast({ message: 'Stipend claimed! +10,000 SCRIP', type: 'success' })
      
      // Record to API (amount in wei: 10000 * 10^18)
      recordClaim(claimHash, '10000000000000000000000')
    }
    if (!claimConfirmed) {
      toastShown.current = false
    }
  }, [claimConfirmed, claimHash, recordClaim])

  return (
    <>
      <CollapsibleSection
        title="Explorer's Stipend"
        icon="💰"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="text-amber-200 font-mono text-sm">{tokenBalance?.formatted?.toFixed(0) ?? '0'}</span>
            <span className="text-stone-500 text-[9px]">SCRIP</span>
          </>
        }
        action={
          <button
            onClick={claimFaucetErc20}
            disabled={!isConnected || claimPending || claimConfirming}
            className="relative w-14 py-1.5 bg-gradient-to-r from-amber-600 to-yellow-700 hover:from-amber-500 hover:to-yellow-600 text-white text-xs font-medium rounded transition-all disabled:opacity-50 text-center"
          >
            {claimPending ? '✍️' : claimConfirming ? '⏳' : claimError ? '✗' : 'Claim'}
            {claimConfirmed && <span className="absolute -top-1 -right-1 text-green-400 text-[10px]">✓</span>}
          </button>
        }
      >
        <div className="text-[9px] text-stone-500 mt-2 mb-1">Recent Claims</div>
        <div className="space-y-0.5">
          {history.length === 0 ? (
            <div className="text-[9px] text-stone-600 py-1">No claims yet</div>
          ) : (
            history.map((h) => {
              const chain = chains.find(c => c.id === h.chainId)
              const txUrl = getExplorerUrl(chain, h.txHash, 'transaction')
              // Convert from wei to display (10000 * 10^18 -> 10000)
              const displayAmount = Math.floor(Number(BigInt(h.amount) / BigInt(10 ** 18)))
              return (
                <div key={h.txHash} className="flex items-center justify-between text-[9px] py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-stone-400">{formatTimeAgo(h.createdAt)}</span>
                    {txUrl ? (
                      <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-500 hover:text-amber-300 font-mono"
                      >
                        {h.txHash.slice(0, 6)}...{h.txHash.slice(-4)} ↗
                      </a>
                    ) : (
                      <span className="text-stone-500 font-mono">
                        {h.txHash.slice(0, 6)}...{h.txHash.slice(-4)}
                      </span>
                    )}
                  </div>
                  <span className="text-amber-300">+{displayAmount.toLocaleString()}</span>
                </div>
              )
            })
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
