import { useConnection, useEnsAvatar, useEnsName } from 'wagmi'
import { useSiweAuth } from '../hooks/useSiweAuth'

export function Connection() {
  const { address } = useConnection()
  const { signOut } = useSiweAuth()
  const { data: ensName } = useEnsName({ address })
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! })

  return (
    <div className="flex items-center gap-1">
      {ensAvatar && <img alt="ENS Avatar" src={ensAvatar} className="w-5 h-5 rounded-full" />}
      {address && (
        <span className="text-[10px] text-amber-200/60 font-mono align-middle">
          {ensName ? ensName : `${address.slice(0, 4)}…${address.slice(-3)}`}
        </span>
      )}
      <button
        onClick={signOut}
        className="px-1.5 py-0.5 bg-stone-700/50 hover:bg-red-900/50 text-amber-200/80 hover:text-red-300 rounded text-[10px] font-medium transition-colors border border-amber-900/30"
      >
        ✕
      </button>
    </div>
  )
}

