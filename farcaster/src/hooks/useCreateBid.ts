import { useState, useCallback } from 'react'
import { useConnection, useReadContract } from 'wagmi'
import { parseEther } from 'viem'
import { useStaticData } from './useStaticData'
import { useAuctionSignature, splitSignature, type BidMessage } from './useAuctionSignature'
import { authFetch } from '../lib/auth'

interface CreateBidParams {
  auctionId: string
  amount: string // in ether units (e.g., "100")
  targetMinHash: [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]
  minMatches?: number // defaults to 5 (exact match)
}

function randomSalt4(): `0x${string}` {
  const bytes = new Uint8Array(4) // bytes4 for bid salt
  crypto.getRandomValues(bytes)
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
}

export function useCreateBid(onSuccess?: () => void) {
  const { address } = useConnection()
  const { staticData } = useStaticData()
  const { signErc20Permit, signBid, isPending: isSigning } = useAuctionSignature()
  
  const [isPosting, setIsPosting] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Get bidder's token nonce for ERC20 permit
  const { data: bidderNonce, refetch: refetchNonce } = useReadContract({
    address: staticData?.mockErc20Addr as `0x${string}`,
    abi: staticData?.mockErc20Abi,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!staticData },
  })

  const createBid = useCallback(async (params: CreateBidParams) => {
    if (!address || !staticData) {
      setError(new Error('Not connected or missing static data'))
      return
    }
    if (bidderNonce === undefined) {
      setError(new Error('Token nonce not loaded'))
      return
    }

    setError(null)
    setIsPosting(true)

    try {
      const amount = parseEther(params.amount)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour
      const salt = randomSalt4()
      const jaccardSwapAddr = staticData.jaccardSwapAddr as `0x${string}`

      // 1. Sign ERC20 permit
      console.log('🔐 Signing ERC20 permit...')
      const erc20PermitSig = await signErc20Permit({
        owner: address as `0x${string}`,
        spender: jaccardSwapAddr,
        value: amount,
        nonce: BigInt(bidderNonce as bigint),
        deadline,
      })
      
      const { v, r, s } = splitSignature(erc20PermitSig)
      console.log('✅ ERC20 permit signed')

      // 2. Sign the Bid
      console.log('🔐 Signing bid...')
      const bidMessage: BidMessage = {
        salt,
        deadline,
        targetMinHash: params.targetMinHash,
        minMatches: params.minMatches ?? 5,
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
      const response = await authFetch(`/api/auction/${params.auctionId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidder: address,
          amount: amount.toString(),
          salt,
          deadline: Number(deadline),
          targetMinHash: params.targetMinHash,
          minMatches: params.minMatches ?? 5,
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
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to place bid')
      }

      console.log('✅ Bid placed successfully')
      
      // Refetch nonce for next bid
      refetchNonce()
      
      onSuccess?.()
      return true
    } catch (err) {
      console.error('❌ Failed to place bid:', err)
      setError(err as Error)
      throw err
    } finally {
      setIsPosting(false)
    }
  }, [address, staticData, bidderNonce, signErc20Permit, signBid, refetchNonce, onSuccess])

  return {
    createBid,
    isPending: isSigning || isPosting,
    isSigning,
    isPosting,
    error,
    bidderNonce,
  }
}
