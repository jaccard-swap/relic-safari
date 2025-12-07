import { useState } from 'react'
import { useConnectors } from 'wagmi'
import { useSiweAuth } from '../hooks/useSiweAuth'

export function WalletOptions() {
  const [open, setOpen] = useState(false)
  const connectors = useConnectors()
  const { isSigning, performSiweAuth } = useSiweAuth()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isSigning}
        className="px-2 py-0.5 bg-amber-700/80 hover:bg-amber-600 text-amber-100 rounded text-[10px] font-medium transition-colors disabled:opacity-50 border border-amber-600/50"
      >
        {isSigning ? '...' : 'Enter'}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-stone-800 border border-amber-900/40 rounded shadow-lg min-w-[100px] z-10">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
              onClick={() => {
                performSiweAuth(connector)
                setOpen(false)
              }}
              className="block w-full text-left px-2 py-1 text-[10px] text-amber-200/70 hover:bg-stone-700 hover:text-amber-200"
        >
              {connector.name}
        </button>
      ))}
        </div>
      )}
    </div>
  )
}

