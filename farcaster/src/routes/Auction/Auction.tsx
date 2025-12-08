import { useState, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { useConnection, useWriteContract, useReadContract, useWaitForTransactionReceipt, useChains } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { authFetch } from '../../lib/auth'
import { useAuctionRoom } from '../../hooks/useAuctionRoom'
import { useAuctionSignature, splitSignature, type FullAuctionMessage, type BidMessage } from '../../hooks/useAuctionSignature'
import { useGetNft } from '../../hooks/useGetNft'
import { useCheckStandingBids } from '../../hooks/useCheckStandingBids'
import { formatTimeLeft, randomSalt } from './utils'
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
    messages,
    highBid,
    loading,
    error,
    connected,
    participantCount,
    settled,
    postChatMessage,
    postBid,
  } = useAuctionRoom(auctionId)

  // Check for matching standing bids once when connected
  const { matchedCount: standingBidsMatched, loading: checkingBids } = useCheckStandingBids(auctionId, connected)

  const { signAuction, signErc20Permit, signBid, staticData } = useAuctionSignature()
  const { writeContractAsync } = useWriteContract()
  
  // Fetch NFT metadata if auction has nftId
  const { nft: nftData } = useGetNft(auction?.nftId)
  
  // Get bidder's token nonce for ERC20 permit
  const { data: bidderNonce } = useReadContract({
    address: staticData?.mockErc20Addr as `0x${string}`,
    abi: staticData?.mockErc20Abi,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!staticData },
  })

  const [chatInput, setChatInput] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [bidding, setBidding] = useState(false)
  const [consuming, setConsuming] = useState(false)
  const [timeLeft, setTimeLeft] = useState('')
  const [settleTxHash, setSettleTxHash] = useState<`0x${string}` | undefined>()
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [settlementData, setSettlementData] = useState<{ winner?: string; winningBid?: string } | null>(null)
  const [showArtifactModal, setShowArtifactModal] = useState(false)
  const [showAuctionInfoModal, setShowAuctionInfoModal] = useState(false)

  // Wait for settlement tx confirmation
  const { isSuccess: isSettled } = useWaitForTransactionReceipt({ hash: settleTxHash })

  // After tx confirmed, call settle API and show modal
  useEffect(() => {
    if (isSettled && settleTxHash && auction && address) {
      const settleOnBackend = async () => {
        try {
          const response = await authFetch(`/api/auction/${auctionId}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auctioneer: address,
              txHash: settleTxHash,
              winner: settlementData?.winner,
              winningBid: settlementData?.winningBid,
            }),
          })
          if (response.ok) {
            console.log('✅ Auction settled on backend')
            
            // Sync NFT ownership to new owner
            if (auction.nftId && settlementData?.winner) {
              try {
                const syncResponse = await authFetch('/api/nft/sync-ownership', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    nftId: auction.nftId,
                    newOwner: settlementData.winner,
                    chainId: auction.chainId,
                  }),
                })
                if (syncResponse.ok) {
                  console.log('✅ NFT ownership synced')
                } else {
                  console.warn('⚠️ Failed to sync NFT ownership')
                }
              } catch (syncErr) {
                console.warn('⚠️ Failed to sync NFT ownership:', syncErr)
              }
            }
          }
        } catch (err) {
          console.error('Failed to settle on backend:', err)
        }
        setShowSuccessModal(true)
      }
      settleOnBackend()
    }
  }, [isSettled, settleTxHash, auction, address, auctionId, settlementData])

  // Check if current user is the auctioneer
  const isAuctioneer = auction?.auctioneer?.toLowerCase() === address?.toLowerCase()

  // Track if we've already shown the modal for this settlement (to prevent re-showing on close)
  const [settledShown, setSettledShown] = useState(false)
  
  // Show modal when receiving SETTLED event via websocket (for non-auctioneers)
  useEffect(() => {
    if (settled && !settledShown && !isAuctioneer) {
      setSettlementData({
        winner: settled.winner,
        winningBid: settled.winningBid,
      })
      setSettleTxHash(settled.txHash as `0x${string}`)
      setShowSuccessModal(true)
      setSettledShown(true)
    }
  }, [settled, settledShown, isAuctioneer])

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
    if (!bidAmount || !address || !auction || !staticData) {
      console.error('❌ Cannot place bid: missing required data')
      return
    }
    if (bidderNonce === undefined) {
      console.error('❌ Cannot place bid: token nonce not loaded')
      return
    }

    try {
      setBidding(true)
      const amount = parseEther(bidAmount)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
      const salt = randomSalt()
      const jaccardSwapAddr = staticData.jaccardSwapAddr as `0x${string}`

      console.log('🔐 Signing ERC20 permit...')
      
      // 1. Sign ERC20 permit (approve token transfer to auction contract)
      const erc20PermitSig = await signErc20Permit({
        owner: address as `0x${string}`,
        spender: jaccardSwapAddr,
        value: amount,
        nonce: BigInt(bidderNonce as bigint),
        deadline,
      })
      
      const { v, r, s } = splitSignature(erc20PermitSig)
      console.log('✅ ERC20 permit signed')

      // 2. Sign the Bid (includes permit data)
      // Get NFT's minHash for similarity matching (exact match = 5/5)
      if (!nftData?.minHash || nftData.minHash.length !== 5) {
        throw new Error('NFT minHash not available')
      }
      const targetMinHash = nftData.minHash as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]
      
      console.log('🔐 Signing bid...')
      const bidMessage: BidMessage = {
        salt,
        deadline,
        targetMinHash,
        minMatches: 5, // Exact match for direct bidding
        permit: {
          owner: address as `0x${string}`,
          spender: jaccardSwapAddr,
          value: amount,
          deadline,
          v,
          r,
          s,
        },
      }
      
      const bidSig = await signBid(bidMessage)
      console.log('✅ Bid signed')

      // 3. Submit to API
      console.log('📤 Submitting bid to API...')
      await postBid({
        amount: amount.toString(),
        salt,
        deadline: Number(deadline),
        targetMinHash,
        minMatches: 5,
        erc20Permit: {
          owner: address,
          spender: jaccardSwapAddr,
          value: amount.toString(),
          deadline: deadline.toString(),
          v,
          r,
          s,
        },
        signature: bidSig,
      })
      
      console.log('✅ Bid placed successfully')
      setBidAmount('')
    } catch (err) {
      console.error('❌ Failed to place bid:', err)
    } finally {
      setBidding(false)
    }
  }

  const handleConsumeAuction = async () => {
    if (!auction || !address || !staticData) return

    try {
      setConsuming(true)
      console.log('🏆 Consuming auction:', auction.id)

      // Fetch auction data for settlement from the consume endpoint
      const response = await fetch(`/api/auction/${auction.id}/consume?auctioneer=${address}`)
      
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to fetch consume data')
      }

      const data = await response.json()
      const auctionData = data.auction
      const bidsList = data.bids || []
      
      console.log('📊 Auction data for settlement:', {
        auction: auctionData,
        bids: bidsList,
        bidCount: bidsList.length,
      })

      if (bidsList.length === 0) {
        throw new Error('No bids to settle')
      }

      // Validate auction has required NFT permit data
      if (!auctionData.nftPermit) {
        throw new Error('Auction missing NFT permit - was the auction created with a signed permit?')
      }
      if (!auctionData.nftPermitSignature) {
        throw new Error('Auction missing NFT permit signature')
      }

      // Validate and build bids array - fail if any bid is missing required data
      const bids: BidMessage[] = []
      const bidSignatures: `0x${string}`[] = []

      for (let i = 0; i < bidsList.length; i++) {
        const bid = bidsList[i]
        
        // Validate required fields
        if (!bid.salt) throw new Error(`Bid ${i} missing salt`)
        if (!bid.deadline) throw new Error(`Bid ${i} missing deadline`)
        if (!bid.targetMinHash || bid.targetMinHash.length !== 5) throw new Error(`Bid ${i} missing targetMinHash`)
        if (bid.minMatches === undefined) throw new Error(`Bid ${i} missing minMatches`)
        if (!bid.bidder) throw new Error(`Bid ${i} missing bidder address`)
        if (!bid.amount) throw new Error(`Bid ${i} missing amount`)
        if (!bid.signature) throw new Error(`Bid ${i} missing signature`)
        
        // Validate ERC20 permit
        if (!bid.erc20Permit) throw new Error(`Bid ${i} missing ERC20 permit`)
        if (bid.erc20Permit.v === undefined) throw new Error(`Bid ${i} ERC20 permit missing v`)
        if (!bid.erc20Permit.r) throw new Error(`Bid ${i} ERC20 permit missing r`)
        if (!bid.erc20Permit.s) throw new Error(`Bid ${i} ERC20 permit missing s`)

        bids.push({
          salt: bid.salt as `0x${string}`,
          deadline: BigInt(Math.floor(new Date(bid.deadline).getTime() / 1000)),
          targetMinHash: bid.targetMinHash as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
          minMatches: bid.minMatches,
          permit: {
            owner: bid.bidder as `0x${string}`,
            spender: staticData.jaccardSwapAddr as `0x${string}`,
            value: BigInt(bid.amount),
            deadline: BigInt(Math.floor(new Date(bid.deadline).getTime() / 1000)),
            v: bid.erc20Permit.v,
            r: bid.erc20Permit.r as `0x${string}`,
            s: bid.erc20Permit.s as `0x${string}`,
          },
        })

        bidSignatures.push(bid.signature as `0x${string}`)
      }

      // Build the NFT permit from stored data (already validated above)
      const nftPermit = {
        owner: auctionData.nftPermit.owner as `0x${string}`,
        spender: staticData.jaccardSwapAddr as `0x${string}`,
        tokenId: BigInt(auctionData.nftPermit.tokenId),
        amount: BigInt(auctionData.nftPermit.amount),
        deadline: BigInt(auctionData.nftPermit.deadline),
        salt: auctionData.nftPermit.salt as `0x${string}`,
      }

      // Build the full auction struct for signing
      const fullAuction: FullAuctionMessage = {
        salt: auctionData.salt as `0x${string}`,
        deadline: BigInt(Math.floor(new Date(auctionData.endTime).getTime() / 1000)),
        nft: auctionData.nftContract as `0x${string}`,
        token: auctionData.tokenContract as `0x${string}`,
        reservePrice: BigInt(auctionData.startingBid),
        nftPermit,
        nftPermitSignature: auctionData.nftPermitSignature as `0x${string}`,
        bids,
        bidSignatures,
      }

      // Final validation - no placeholders allowed
      if (!fullAuction.salt || fullAuction.salt.length < 10) {
        throw new Error('Auction missing salt')
      }

      console.log('🔗 Full auction struct:', fullAuction)

      // Sign the auction
      console.log('✍️ Signing auction...')
      const auctionSig = await signAuction(fullAuction)
      console.log('✅ Auction signed:', auctionSig)

      // Call the contract
      console.log('📝 Calling consumeAuction on contract...')
      const hash = await writeContractAsync({
        address: staticData.jaccardSwapAddr as `0x${string}`,
        abi: staticData.jaccardSwapAbi,
        functionName: 'consumeAuction',
        args: [fullAuction, auctionSig] as const,
      })

      console.log('✅ Transaction submitted:', hash)
      
      // Store tx hash to wait for confirmation
      const winningBidData = bidsList[0]
      setSettlementData({
        winner: winningBidData?.bidder,
        winningBid: winningBidData?.amount ? formatEther(BigInt(winningBidData.amount)) : undefined,
      })
      setSettleTxHash(hash)
    } catch (err) {
      console.error('❌ Failed to consume auction:', err)
    } finally {
      setConsuming(false)
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
          messages={messages}
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
        winnerAddress={settlementData?.winner}
        finalBid={settlementData?.winningBid ? `${settlementData.winningBid} tokens` : undefined}
        nftName={auction?.title}
        txHash={settleTxHash}
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
