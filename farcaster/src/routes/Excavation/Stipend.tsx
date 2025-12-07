import { useState, useCallback, useEffect, useRef } from 'react'
import { useErc20Faucet } from '../../hooks/useFaucet'
import { useFaucetBalances } from '../../hooks/useFaucetBalances'
import { CollapsibleSection } from '../../components/CollapsibleSection'
import { Toast } from '../../components/Toast'

// Mock stipend history - TODO: fetch from API
const MOCK_STIPEND_HISTORY = [
  { date: '2 hours ago', amount: 10000, tx: '0x1234...5678' },
  { date: '1 day ago', amount: 10000, tx: '0x2345...6789' },
  { date: '3 days ago', amount: 10000, tx: '0x3456...7890' },
]

interface StipendProps {
  expanded: boolean
  onToggle: () => void
  onHelp: () => void
}

export function Stipend({ expanded, onToggle, onHelp }: StipendProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastShown = useRef(false)

  const { tokenBalance, refetchBalances, isConnected } = useFaucetBalances()

  const handleSuccess = useCallback(() => {
    refetchBalances()
  }, [refetchBalances])

  const {
    claimFaucetErc20,
    isPending: claimPending,
    isConfirming: claimConfirming,
    isConfirmed: claimConfirmed,
    error: claimError
  } = useErc20Faucet(handleSuccess)

  // Show toast on claim success
  useEffect(() => {
    if (claimConfirmed && !toastShown.current) {
      toastShown.current = true
      setToast({ message: 'Stipend claimed! +10,000 SCRIP', type: 'success' })
    }
    if (!claimConfirmed) {
      toastShown.current = false
    }
  }, [claimConfirmed])

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
          {MOCK_STIPEND_HISTORY.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-[9px] py-0.5">
              <span className="text-stone-400">{h.date}</span>
              <span className="text-amber-300">+{h.amount.toLocaleString()}</span>
            </div>
          ))}
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
