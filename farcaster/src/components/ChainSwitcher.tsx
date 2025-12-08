import { useState, useEffect } from 'react'
import { useConnection, useChainId, useChains, useSwitchChain } from 'wagmi'

export function ChainSwitcher() {
  const [open, setOpen] = useState(false)
  const [switchAttempted, setSwitchAttempted] = useState(false)
  
  const connection = useConnection()
  const chainId = useChainId() // wagmi's active chain
  const chains = useChains()
  const { switchChain, isPending } = useSwitchChain()

  const currentChain = chains.find((c) => c.id === chainId)
  const isSupportedChain = chains.some((c) => c.id === chainId)
  
  // Mismatch: wallet reports different chain than wagmi's target
  const hasMismatch = connection.isConnected && connection.chain && connection.chain.id !== chainId

  // Auto-switch attempt on connect if wallet is on wrong chain
  useEffect(() => {
    if (connection.isConnected && connection.chain && !isSupportedChain && !switchAttempted) {
      // Wallet is on unsupported chain, try to switch to first supported
      setSwitchAttempted(true)
      switchChain?.({ chainId: chains[0].id })
    }
  }, [connection.isConnected, connection.chain, isSupportedChain, switchAttempted, chains])

  // Reset switch attempt flag on disconnect
  useEffect(() => {
    if (!connection.isConnected) setSwitchAttempted(false)
  }, [connection.isConnected])

  return (
    <div className="relative flex items-center gap-1">
      {/* Warning icon if mismatch */}
      {hasMismatch && (
        <span 
          className="text-yellow-500 cursor-help" 
          title={`Wallet on ${connection.chain?.name ?? 'unknown'}. Add ${currentChain?.name} to wallet for full functionality. Transactions use our RPC.`}
        >
          ⚠️
        </span>
      )}
      
      <span className="text-[10px] text-amber-200/60 font-mono align-middle">
        {isPending ? '...' : currentChain?.name ?? '?'}
      </span>
      
      {/* Show wallet chain if mismatched */}
      {hasMismatch && (
        <span className="text-[8px] text-yellow-500/60 font-mono">
          (wallet: {connection.chain?.name})
        </span>
      )}
      
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="px-1.5 py-0.5 bg-stone-700/50 hover:bg-stone-600/50 text-amber-200/80 rounded text-[10px] font-medium transition-colors disabled:opacity-50 border border-amber-900/30"
      >
        {open ? '▲' : '▼'}
      </button>
      
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-stone-800 border border-amber-900/40 rounded shadow-lg min-w-[120px] z-10">
          {chains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                switchChain?.({ chainId: chain.id })
                setOpen(false)
              }}
              className={`block w-full text-left px-2 py-1 text-[10px] hover:bg-stone-700 ${
                chain.id === chainId ? 'text-amber-300 font-medium' : 'text-amber-200/70'
              }`}
            >
              {chain.name}
              {connection.chain?.id === chain.id && ' ✓'}
            </button>
          ))}
          
          {hasMismatch && (
            <div className="px-2 py-1 text-[8px] text-yellow-500/80 border-t border-amber-900/30">
              Add network to wallet for signing
            </div>
          )}
        </div>
      )}
    </div>
  )
}
