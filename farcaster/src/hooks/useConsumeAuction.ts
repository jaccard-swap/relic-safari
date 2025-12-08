import { useState, useEffect, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useConnection } from 'wagmi'
import { formatEther } from 'viem'
import { useStaticData } from './useStaticData'
import { useAuctionSignature, type FullAuctionMessage, type BidMessage } from './useAuctionSignature'
import { authFetch } from '../lib/auth'

interface ConsumeResult {
  success: boolean
  txHash?: `0x${string}`
  winner?: string
  winningBid?: string
}

interface AuctionInfo {
  id: string
  nftId?: string
  chainId?: number
}

export function useConsumeAuction(onSuccess?: (result: ConsumeResult) => void) {
  const { address } = useConnection()
  const { staticData } = useStaticData()
  const { signAuction, isPending: isSigning } = useAuctionSignature()
  
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [isFetching, setIsFetching] = useState(false)
  const [settlementData, setSettlementData] = useState<{
    auctionId: string
    winner?: string
    winningBid?: string
    nftId?: string
    chainId?: number
  } | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const { 
    writeContractAsync, 
    isPending: isWriting,
    error: writeError,
    reset 
  } = useWriteContract()

  const { isSuccess: isConfirmed, isLoading: isConfirming } = 
    useWaitForTransactionReceipt({ hash: txHash })

  // After tx confirmed, notify backend to broadcast to room
  useEffect(() => {
    if (isConfirmed && txHash && settlementData && address) {
      const settleOnBackend = async () => {
        try {
          // 1. Mark auction as settled in DB + broadcast to room
          const response = await authFetch(`/api/auction/${settlementData.auctionId}/settle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              auctioneer: address,
              txHash,
              winner: settlementData.winner,
              winningBid: settlementData.winningBid,
            }),
          })

          if (!response.ok) {
            console.warn('⚠️ Failed to settle on backend')
          } else {
            console.log('✅ Auction settled on backend, room notified')
          }

          // 2. Sync NFT ownership to new winner
          console.log('🔄 Sync ownership check:', {
            nftId: settlementData.nftId,
            winner: settlementData.winner,
            chainId: settlementData.chainId,
          })
          if (settlementData.nftId && settlementData.winner && settlementData.chainId) {
            const syncResponse = await authFetch('/api/nft/sync-ownership', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nftId: settlementData.nftId,
                newOwner: settlementData.winner,
                chainId: settlementData.chainId,
              }),
            })
            if (syncResponse.ok) {
              console.log('✅ NFT ownership synced')
            } else {
              const errData = await syncResponse.json().catch(() => ({}))
              console.warn('⚠️ NFT ownership sync failed:', syncResponse.status, errData)
            }
          } else {
            console.warn('⚠️ Missing data for NFT ownership sync - skipped')
          }

          onSuccess?.({ 
            success: true, 
            txHash,
            winner: settlementData.winner,
            winningBid: settlementData.winningBid,
          })
        } catch (err) {
          console.error('Failed to settle on backend:', err)
          // TX succeeded on-chain, so still report success
          onSuccess?.({ 
            success: true, 
            txHash,
            winner: settlementData.winner,
            winningBid: settlementData.winningBid,
          })
        }
      }

      settleOnBackend()
    }
  }, [isConfirmed, txHash, settlementData, address, onSuccess])

  const consumeAuction = useCallback(async (auction: AuctionInfo) => {
    if (!address || !staticData) {
      setError(new Error('Not connected or missing static data'))
      return
    }

    // Note: removed reset() - was causing issues with Farcaster wallet
    setError(null)
    setTxHash(undefined)
    setIsFetching(true)

    try {
      console.log('🏆 Consuming auction:', auction.id, 'auctioneer:', address)

      // 1. Fetch auction data from API
      const url = `/api/auction/${auction.id}/consume?auctioneer=${address}`
      console.log('🏆 Fetching consume data from:', url)
      
      const response = await authFetch(url)
      console.log('🏆 Consume response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errText = await response.text()
        console.error('🏆 Consume error response:', errText)
        let err
        try { err = JSON.parse(errText) } catch { err = { error: errText } }
        throw new Error(err.error || 'Failed to fetch consume data')
      }

      const data = await response.json()
      const auctionData = data.auction
      const bidsList = data.bids || []
      
      console.log('📊 Auction data for settlement:', {
        auctionId: auctionData?.id,
        status: auctionData?.status,
        hasNftPermit: !!auctionData?.nftPermit,
        hasNftPermitSig: !!auctionData?.nftPermitSignature,
        salt: auctionData?.salt,
        bidCount: bidsList.length,
        bids: bidsList.map((b: any) => ({
          bidder: b.bidder,
          amount: b.amount,
          hasSig: !!b.signature,
          hasPermit: !!b.erc20Permit,
          salt: b.salt,
        })),
      })

      if (bidsList.length === 0) {
        console.error('❌ No bids to settle')
        throw new Error('No bids to settle')
      }

      // 2. Validate auction has required NFT permit data
      console.log('🔍 Validating auction data...', {
        hasNftPermit: !!auctionData.nftPermit,
        nftPermit: auctionData.nftPermit,
        hasNftPermitSig: !!auctionData.nftPermitSignature,
      })
      
      if (!auctionData.nftPermit) {
        console.error('❌ Auction missing NFT permit')
        throw new Error('Auction missing NFT permit - was the auction created with a signed permit?')
      }
      if (!auctionData.nftPermitSignature) {
        console.error('❌ Auction missing NFT permit signature')
        throw new Error('Auction missing NFT permit signature')
      }

      // 3. Validate and build bids array
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

      // 4. Build the NFT permit
      const nftPermit = {
        owner: auctionData.nftPermit.owner as `0x${string}`,
        spender: staticData.jaccardSwapAddr as `0x${string}`,
        tokenId: BigInt(auctionData.nftPermit.tokenId),
        amount: BigInt(auctionData.nftPermit.amount),
        deadline: BigInt(auctionData.nftPermit.deadline),
        salt: auctionData.nftPermit.salt as `0x${string}`,
      }

      // 5. Build the full auction struct
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

      // Final validation
      if (!fullAuction.salt || fullAuction.salt.length < 10) {
        throw new Error('Auction missing salt')
      }

      console.log('🔗 Full auction struct:', fullAuction)
      setIsFetching(false)

      // 6. Sign the auction
      console.log('✍️ Signing auction...')
      const auctionSig = await signAuction(fullAuction)
      console.log('✅ Auction signed:', auctionSig)

      // 7. Call the contract
      console.log('📝 Calling consumeAuction on contract...', {
        contractAddr: staticData.jaccardSwapAddr,
        auctionSalt: fullAuction.salt,
        bidCount: fullAuction.bids.length,
      })
      
      let hash: `0x${string}`
      try {
        hash = await writeContractAsync({
          address: staticData.jaccardSwapAddr as `0x${string}`,
          abi: staticData.jaccardSwapAbi,
          functionName: 'consumeAuction',
          args: [fullAuction, auctionSig] as const,
        })
        console.log('✅ Transaction submitted:', hash)
      } catch (txErr: any) {
        console.error('❌ Contract call failed:', txErr)
        console.error('❌ Error details:', {
          message: txErr?.message,
          shortMessage: txErr?.shortMessage,
          cause: txErr?.cause,
        })
        throw txErr
      }
      
      // Store data for post-confirmation settlement
      const winningBidData = bidsList[0]
      const winner = winningBidData?.bidder
      const winningBid = winningBidData?.amount ? formatEther(BigInt(winningBidData.amount)) : undefined

      console.log('📋 Settlement data being stored:', {
        auctionId: auction.id,
        winner,
        winningBid,
        nftId: auction.nftId,
        chainId: auction.chainId,
        hasNftId: !!auction.nftId,
      })

      setTxHash(hash)
      setSettlementData({
        auctionId: auction.id,
        winner,
        winningBid,
        nftId: auction.nftId,
        chainId: auction.chainId,
      })

      return { hash, winner, winningBid }
    } catch (err) {
      console.error('❌ Failed to consume auction:', err)
      setError(err as Error)
      setIsFetching(false)
      throw err
    }
  }, [address, staticData, signAuction, writeContractAsync])

  return {
    consumeAuction,
    txHash,
    settlementData,
    isFetching,
    isSigning,
    isWriting,
    isConfirming,
    isConfirmed,
    isPending: isFetching || isSigning || isWriting || isConfirming,
    error: error || writeError,
    reset: () => {
      reset()
      setError(null)
      setTxHash(undefined)
      setSettlementData(null)
    },
  }
}
