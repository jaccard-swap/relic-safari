import { useState, useEffect, useCallback } from 'react'
import { useParams } from '@tanstack/react-router'
import { useConnection, useChains } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { useAuctionRoom } from '../../hooks/useAuctionRoom'
import { useConsumeAuction } from '../../hooks/useConsumeAuction'
import { useCreateBid } from '../../hooks/useCreateBid'
import { useGetNft } from '../../hooks/useGetNft'
import { useCheckStandingBids } from '../../hooks/useCheckStandingBids'
import { invalidateNfts } from '../../stores/nftStore'
import { formatTimeLeft } from './utils'
import { AuctionHeader } from './AuctionHeader'
import { ActivityFeed } from './ActivityFeed'
import { ActionPanel } from './ActionPanel'
import { SuccessModal } from '../../components/SuccessModal'
import { InfoModal } from '../../components/InfoModal'
import type { NftMetadata } from '../../stores/nftStore'
import { 
  FORM_EMOJI, 
  QUALITY_EMOJI,
  QUALITY_BADGE,
  INSCRIPTION_EMOJI,
  INSCRIPTION_STYLES,
  AGE_STYLES,
  MATERIAL_STYLES,
  SITE_STYLES,
  RARITY_EMOJI,
  getNameStyles,
} from '../../utils/artifactStyles'

export function Auction() {
  const { auctionId } = useParams({ from: '/auction/$auctionId' })
  const { address } = useConnection()
  const chains = useChains()
  
  const {
    auction,
    events,
    highBid,
    loading,
    error,
    connected,
    participantCount,
    settled,
    postChatMessage,
    refetch,
  } = useAuctionRoom(auctionId)

  // Check for matching standing bids once when connected
  const { matchedCount: standingBidsMatched, loading: checkingBids } = useCheckStandingBids(auctionId, connected)
  
  // Refetch auction data when standing bids are attached
  useEffect(() => {
    if (standingBidsMatched && standingBidsMatched > 0) {
      refetch()
    }
  }, [standingBidsMatched, refetch])

  // Fetch NFT metadata if auction has nftId
  const { nft: nftData } = useGetNft(auction?.nftId)
  
  // Handle consume auction success - show modal and refresh NFTs
  const handleConsumeSuccess = useCallback(() => {
    setShowSuccessModal(true)
    // Refresh NFT list - auctioneer loses the NFT
    invalidateNfts()
  }, [])
  
  const { 
    consumeAuction, 
    isPending: consuming,
    txHash: settleTxHash,
    settlementData,
  } = useConsumeAuction(handleConsumeSuccess)
  
  // Handle bid success - clear input
  const handleBidSuccess = useCallback(() => {
    setBidAmount('')
  }, [])
  
  const { 
    createBid, 
    isPending: bidding,
  } = useCreateBid(handleBidSuccess)

  const [chatInput, setChatInput] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [timeLeft, setTimeLeft] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [showArtifactModal, setShowArtifactModal] = useState(false)
  const [showAuctionInfoModal, setShowAuctionInfoModal] = useState(false)
  // State for websocket-received settlement (for non-auctioneers)
  const [wsSettlement, setWsSettlement] = useState<{ winner?: string; winningBid?: string; txHash?: `0x${string}` } | null>(null)

  // Check if current user is the auctioneer
  const isAuctioneer = auction?.auctioneer?.toLowerCase() === address?.toLowerCase()

  // Track if we've already shown the modal for this settlement (to prevent re-showing on close)
  const [settledShown, setSettledShown] = useState(false)
  
  // Show modal when receiving SETTLED event via websocket (for non-auctioneers)
  // Also refresh NFTs if current user is the winner
  useEffect(() => {
    if (settled && !settledShown && !isAuctioneer) {
      setWsSettlement({
        winner: settled.winner,
        winningBid: settled.winningBid,
        txHash: settled.txHash as `0x${string}`,
      })
      setShowSuccessModal(true)
      setSettledShown(true)
      
      // If current user is the winner, refresh their NFT list
      if (settled.winner?.toLowerCase() === address?.toLowerCase()) {
        invalidateNfts()
      }
    }
  }, [settled, settledShown, isAuctioneer, address])

  // Update time remaining
  useEffect(() => {
    if (!auction?.endTime) return
    
    const update = () => setTimeLeft(formatTimeLeft(auction.endTime))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [auction?.endTime])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    
    await postChatMessage(chatInput)
    setChatInput('')
  }

  const handlePlaceBid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bidAmount || !address || !auction || !nftData?.minHash) return
    
    // Get NFT's minHash for similarity matching (exact match = 5/5)
    if (nftData.minHash.length !== 5) {
      console.error('❌ NFT minHash invalid')
      return
    }
    
    try {
      await createBid({
        auctionId: auction.id,
        amount: bidAmount,
        targetMinHash: nftData.minHash as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
        minMatches: 5, // Exact match for direct bidding
      })
    } catch (err) {
      // Error already logged in hook
    }
  }

  const handleConsumeAuction = async () => {
    if (!auction || !address) return
    
    try {
      await consumeAuction({
        id: auction.id,
        nftId: auction.nftId,
        chainId: auction.chainId,
      })
    } catch (err) {
      // Error already logged in hook
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-stone-400 text-xs">Loading auction...</div>
      </div>
    )
  }

  if (error || !auction) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-400 text-xs">{error || 'Auction not found'}</div>
      </div>
    )
  }

  const isEnded = timeLeft === 'Ended'
  const minBid = BigInt(highBid) > 0n 
    ? formatEther(BigInt(highBid) + parseEther('0.001'))
    : formatEther(BigInt(auction.startingBid))

  return (
    <div className="p-3 space-y-2">
        <AuctionHeader
          auction={auction}
          nftData={nftData}
          highBid={highBid}
          timeLeft={timeLeft}
          isEnded={isEnded}
          isAuctioneer={isAuctioneer}
          connected={connected}
          participantCount={participantCount}
          chain={chains.find(c => c.id === auction?.chainId)}
          onShowArtifact={() => setShowArtifactModal(true)}
          onShowAuctionInfo={() => setShowAuctionInfoModal(true)}
        />

        <ActivityFeed
          events={events}
          address={address}
          chain={chains.find(c => c.id === auction?.chainId)}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onSendMessage={handleSendMessage}
        />

      <ActionPanel
        isEnded={isEnded}
        isAuctioneer={isAuctioneer}
        address={address}
        highBid={highBid}
        minBid={minBid}
        bidAmount={bidAmount}
        bidding={bidding}
        consuming={consuming}
        onBidAmountChange={setBidAmount}
        onPlaceBid={handlePlaceBid}
        onConsumeAuction={handleConsumeAuction}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="🎉 Auction Settled!"
        message="The auction has been successfully completed on-chain."
        winnerAddress={settlementData?.winner || wsSettlement?.winner}
        finalBid={(settlementData?.winningBid || wsSettlement?.winningBid) ? `${settlementData?.winningBid || wsSettlement?.winningBid} tokens` : undefined}
        nftName={auction?.title}
        txHash={settleTxHash || wsSettlement?.txHash}
        chain={chains.find(c => c.id === auction?.chainId)}
      />

      {/* Artifact Details Modal */}
      {(() => {
        const metadata = nftData?.metadata as NftMetadata | undefined
        const rarity = metadata?.rarity as string || 'common'
        const form = metadata?.form as string
        const age = metadata?.age as string
        const material = metadata?.material as string
        const quality = metadata?.quality as string
        const inscription = metadata?.inscription as string
        const site = metadata?.site as string
        const nameStyles = getNameStyles(rarity)
        
        return (
          <InfoModal
            open={showArtifactModal}
            onClose={() => setShowArtifactModal(false)}
            title={auction?.title || 'Artifact'}
            icon={form ? FORM_EMOJI[form] || '⚱️' : '⚱️'}
          >
            {/* Rarity badge */}
            {metadata && (
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-lg ${nameStyles}`}>{RARITY_EMOJI[rarity]}</span>
                <span className={`text-sm font-semibold ${nameStyles}`}>{rarity}</span>
              </div>
            )}

            {/* Traits */}
            {metadata && (
              <div className="space-y-1.5 mb-3">
                {age && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Age</span>
                    <span className={AGE_STYLES[age]?.style}>{AGE_STYLES[age]?.emoji} {age}</span>
                  </div>
                )}
                {material && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Material</span>
                    <span className={MATERIAL_STYLES[material]?.style}>{MATERIAL_STYLES[material]?.emoji} {material}</span>
                  </div>
                )}
                {quality && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Quality</span>
                    <span className={QUALITY_BADGE[quality]}>{QUALITY_EMOJI[quality]} {quality}</span>
                  </div>
                )}
                {form && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Form</span>
                    <span className="text-stone-300">{FORM_EMOJI[form]} {form}</span>
                  </div>
                )}
                {inscription && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Inscription</span>
                    <span className={INSCRIPTION_STYLES[inscription]}>{INSCRIPTION_EMOJI[inscription]} {inscription}</span>
                  </div>
                )}
                {site && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Origin</span>
                    <span className={SITE_STYLES[site]?.style}>{SITE_STYLES[site]?.emoji} {site.replace('-', ' ')}</span>
                  </div>
                )}
              </div>
            )}

            {/* On-chain data */}
            <div className="pt-2 border-t border-stone-700 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-stone-500">Token ID</span>
                <span className="text-stone-400 font-mono">
                  {auction?.nftTokenId && auction.nftTokenId.length > 16 
                    ? `${auction.nftTokenId.slice(0, 8)}...${auction.nftTokenId.slice(-6)}` 
                    : auction?.nftTokenId}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-stone-500">Contract</span>
                <span className="text-stone-400 font-mono">
                  {auction?.nftContract?.slice(0, 6)}...{auction?.nftContract?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-stone-500">Chain</span>
                <span className="text-stone-400">
                  {auction?.chainId === 84532 ? 'Base Sepolia' : `Chain ${auction?.chainId}`}
                </span>
              </div>
            </div>
          </InfoModal>
        )
      })()}

      {/* Auction Process Info Modal */}
      <InfoModal
        open={showAuctionInfoModal}
        onClose={() => setShowAuctionInfoModal(false)}
        title="How Auctions Work"
        icon="🏛️"
      >
        <p>
          <strong className="text-amber-300">1. Place Bids</strong> — Sign a bid with your wallet. Your SCRIP is held in escrow via ERC-20 permit.
        </p>
        <p>
          <strong className="text-amber-300">2. Outbid Others</strong> — Higher bids replace lower ones. You can bid multiple times.
        </p>
        <p>
          <strong className="text-amber-300">3. Settlement</strong> — When time expires, the seller calls "Settle" to transfer the artifact to the winner and collect payment.
        </p>
        <p className="text-stone-500 text-[10px] pt-2 border-t border-stone-700">
          Technical: Uses EIP-712 signatures for gasless bidding. Settlement executes all permits on-chain.
        </p>
      </InfoModal>

      {/* Standing bid check toast - only show while loading or if matches found */}
      {(checkingBids || (standingBidsMatched && standingBidsMatched > 0)) && (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-right-5 duration-300">
          <div className={`px-3 py-2 rounded-lg shadow-lg border ${
            standingBidsMatched && standingBidsMatched > 0
              ? 'bg-emerald-900/90 border-emerald-600'
              : 'bg-stone-800 border-stone-600'
          }`}>
            <div className="flex items-center gap-2 text-xs">
              {checkingBids ? (
                <>
                  <span className="animate-spin">🔍</span>
                  <span className="text-stone-300">Checking for matching buy orders...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span className="text-emerald-300">
                    {standingBidsMatched} standing order{standingBidsMatched! > 1 ? 's' : ''} matched!
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
