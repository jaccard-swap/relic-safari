import { formatEther } from 'viem'

interface BidFormProps {
  bidAmount: string
  minBid: string
  bidding: boolean
  onBidAmountChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

function BidForm({ bidAmount, minBid, bidding, onBidAmountChange, onSubmit }: BidFormProps) {
  return (
    <form onSubmit={onSubmit} className="bg-stone-800/50 border border-amber-900/30 rounded-lg p-2">
      <div className="text-[10px] text-amber-300 mb-1.5">💰 Place Bid</div>
      <div className="flex gap-1.5">
        <div className="flex-1 relative">
          <input
            type="text"
            value={bidAmount}
            onChange={(e) => onBidAmountChange(e.target.value)}
            placeholder={`Min ${minBid}`}
            className="w-full px-2 py-1.5 bg-stone-900/50 border border-stone-700 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-700"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 text-[9px]">SCRIP</span>
        </div>
        <button
          type="submit"
          disabled={bidding || !bidAmount}
          className="w-14 py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-xs font-medium rounded transition-colors"
        >
          {bidding ? '⏳' : 'Bid'}
        </button>
      </div>
    </form>
  )
}

interface ConsumeAuctionPanelProps {
  consuming: boolean
  onConsume: () => void
}

function ConsumeAuctionPanel({ consuming, onConsume }: ConsumeAuctionPanelProps) {
  return (
    <div className="bg-stone-800/50 border border-amber-900/30 rounded-lg p-2">
      <div className="text-[10px] text-amber-300 mb-1">🏆 Settle Auction</div>
      <div className="text-[9px] text-stone-400 mb-2">
        Transfer the artifact to the highest bidder and collect payment.
      </div>
      <button
        onClick={onConsume}
        disabled={consuming}
        className="w-full py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-xs font-medium rounded transition-colors"
      >
        {consuming ? '⏳ Settling...' : '🏆 Settle'}
      </button>
    </div>
  )
}

interface EndedPanelProps {
  highBid: string
  isAuctioneer: boolean
  consuming: boolean
  onConsume: () => void
}

function EndedPanel({ highBid, isAuctioneer, consuming, onConsume }: EndedPanelProps) {
  return (
    <div className="bg-stone-800/50 border border-amber-900/30 rounded-lg p-2 text-center">
      <div className="text-amber-400 text-sm font-medium">🏆 Auction Ended</div>
      <div className="text-[10px] text-stone-400 mt-0.5">
        Final: {formatEther(BigInt(highBid))} SCRIP
      </div>
      {isAuctioneer && (
        <button
          onClick={onConsume}
          disabled={consuming}
          className="mt-2 w-full py-1.5 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-xs font-medium rounded transition-colors"
        >
          {consuming ? '⏳ Settling...' : '🏆 Settle & Transfer'}
        </button>
      )}
    </div>
  )
}

interface ActionPanelProps {
  isEnded: boolean
  isAuctioneer: boolean
  address?: string
  highBid: string
  minBid: string
  bidAmount: string
  bidding: boolean
  consuming: boolean
  onBidAmountChange: (value: string) => void
  onPlaceBid: (e: React.FormEvent) => void
  onConsumeAuction: () => void
}

export function ActionPanel({
  isEnded,
  isAuctioneer,
  address,
  highBid,
  minBid,
  bidAmount,
  bidding,
  consuming,
  onBidAmountChange,
  onPlaceBid,
  onConsumeAuction,
}: ActionPanelProps) {
  if (isEnded) {
    return (
      <EndedPanel
        highBid={highBid}
        isAuctioneer={isAuctioneer}
        consuming={consuming}
        onConsume={onConsumeAuction}
      />
    )
  }

  if (!address) return null

  if (isAuctioneer) {
    return (
      <ConsumeAuctionPanel
        consuming={consuming}
        onConsume={onConsumeAuction}
      />
    )
  }

  return (
    <BidForm
      bidAmount={bidAmount}
      minBid={minBid}
      bidding={bidding}
      onBidAmountChange={onBidAmountChange}
      onSubmit={onPlaceBid}
    />
  )
}
