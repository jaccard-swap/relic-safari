import { useState, useEffect, useCallback } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useConnection } from 'wagmi'
import { useStaticData } from './useStaticData'
import { useAuctionSignature, type FullAuctionMessage } from './useAuctionSignature'
import { authFetch } from '../lib/auth'

interface ConsumeAuctionParams {
  auctionId: string
  fullAuction: FullAuctionMessage
  winner?: string
  winningBid?: string
  nftId?: string
  chainId?: number
}

interface ConsumeResult {
  success: boolean
  txHash?: `0x${string}`
  error?: string
}

export function useConsumeAuction(onSuccess?: (result: ConsumeResult) => void) {
  const { address } = useConnection()
  const { staticData } = useStaticData()
  const { signAuction, isPending: isSigning } = useAuctionSignature()
  
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
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
            }
          }

          onSuccess?.({ success: true, txHash })
        } catch (err) {
          console.error('Failed to settle on backend:', err)
          // TX succeeded on-chain, so still report success
          onSuccess?.({ success: true, txHash })
        }
      }

      settleOnBackend()
    }
  }, [isConfirmed, txHash, settlementData, address, onSuccess])

  const consumeAuction = useCallback(async (params: ConsumeAuctionParams) => {
    if (!address || !staticData) {
      setError(new Error('Not connected or missing static data'))
      return
    }

    reset()
    setError(null)
    setTxHash(undefined)

    try {
      console.log('✍️ Signing auction...')
      const auctionSig = await signAuction(params.fullAuction)
      console.log('✅ Auction signed:', auctionSig)

      console.log('📝 Calling consumeAuction on contract...')
      const hash = await writeContractAsync({
        address: staticData.jaccardSwapAddr as `0x${string}`,
        abi: staticData.jaccardSwapAbi,
        functionName: 'consumeAuction',
        args: [params.fullAuction, auctionSig] as const,
      })

      console.log('✅ Transaction submitted:', hash)
      
      // Store data for post-confirmation settlement
      setTxHash(hash)
      setSettlementData({
        auctionId: params.auctionId,
        winner: params.winner,
        winningBid: params.winningBid,
        nftId: params.nftId,
        chainId: params.chainId,
      })

      return hash
    } catch (err) {
      console.error('❌ Failed to consume auction:', err)
      setError(err as Error)
      throw err
    }
  }, [address, staticData, signAuction, writeContractAsync, reset])

  return {
    consumeAuction,
    txHash,
    isSigning,
    isWriting,
    isConfirming,
    isConfirmed,
    isPending: isSigning || isWriting || isConfirming,
    error: error || writeError,
    reset: () => {
      reset()
      setError(null)
      setTxHash(undefined)
      setSettlementData(null)
    },
  }
}
