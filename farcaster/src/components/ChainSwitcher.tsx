import { useState } from 'react'
import { useChainId, useChains, useSwitchChain } from 'wagmi'

export function ChainSwitcher() {
  const [open, setOpen] = useState(false)
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain, isPending } = useSwitchChain()

  const currentChain = chains.find((c) => c.id === chainId)

  return (
    <div className="relative flex items-center gap-1">
      <span className="text-[10px] text-amber-200/60 font-mono align-middle">
        {isPending ? '...' : currentChain?.name ?? '?'}
      </span>
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="px-1.5 py-0.5 bg-stone-700/50 hover:bg-stone-600/50 text-amber-200/80 rounded text-[10px] font-medium transition-colors disabled:opacity-50 border border-amber-900/30"
      >
        {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-stone-800 border border-amber-900/40 rounded shadow-lg min-w-[100px] z-10">
          {chains.map((chain) => (
            <button
              key={chain.id}
              onClick={() => {
                switchChain({ chainId: chain.id })
                setOpen(false)
              }}
              className={`block w-full text-left px-2 py-1 text-[10px] hover:bg-stone-700 ${
                chain.id === chainId ? 'text-amber-300 font-medium' : 'text-amber-200/70'
              }`}
            >
              {chain.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
