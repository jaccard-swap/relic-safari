import { MyNfts } from "./components/MyNfts"
import { useFaucetBalances } from "./hooks/useFaucetBalances"

function App() {
  const { tokenBalance, essenceBalance } = useFaucetBalances()

  return (
    <div className="p-3 space-y-2">
      {/* Balances */}
      <div className="bg-stone-800/50 border border-amber-900/30 rounded-lg p-2 flex items-center justify-around">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-200 font-mono text-sm">{tokenBalance?.formatted?.toFixed(0) ?? '0'}</span>
          <span className="text-stone-500 text-[9px]">💰 SCRIP</span>
        </div>
        <div className="w-px h-4 bg-stone-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-purple-300 font-mono text-sm">{essenceBalance?.count ?? 0}</span>
          <span className="text-stone-500 text-[9px]">✨ Essence</span>
        </div>
      </div>

      <MyNfts />
    </div>
  )
}

export default App
