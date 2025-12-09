import { useState, useCallback } from 'react'
import { useConnection, useSignTypedData, useReadContract } from 'wagmi'
import { parseEther } from 'viem'
import { useStaticData } from './useStaticData'
import { BidTypes, ERC20PermitTypes, EIP712_DOMAINS } from '@shared/constants'
import { authFetch } from '../lib/auth'

interface StandingBidParams {
  amount: string // in ether
  targetMinHash: `0x${string}`[]
  minMatches: number
  desiredTraits: Record<string, string>
}

export function useStandingBid() {
  const { address, chainId } = useConnection()
  const { staticData } = useStaticData()
  const { signTypedDataAsync } = useSignTypedData()
  
  // Read nonce from token contract for ERC20 permit
  const { data: tokenNonce } = useReadContract({
    address: staticData?.scripAddr as `0x${string}`,
    abi: staticData?.scripAbi,
    functionName: 'nonces',
    args: address ? [address] : undefined,
    query: { enabled: !!staticData && !!address },
  })
  
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const createStandingBid = useCallback(async (params: StandingBidParams) => {
    if (!address || !staticData) {
      setError('Wallet not connected')
      return null
    }
    
    if (tokenNonce === undefined) {
      setError('Token nonce not loaded')
      return null
    }

    setIsPending(true)
    setError(null)
    setSuccess(false)

    try {
      const { jaccardSwapAddr, scripAddr } = staticData
      const amount = parseEther(params.amount)
      
      // Generate random salt
      const saltBytes = new Uint8Array(4)
      crypto.getRandomValues(saltBytes)
      const salt = ('0x' + Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
      
      // Deadline: 7 days from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60)

      // First, sign the ERC20 permit (must match Scrip contract's EIP-712 domain)
      const permitDomain = {
        name: EIP712_DOMAINS.SCRIP,
        version: '1',
        chainId,
        verifyingContract: scripAddr as `0x${string}`,
      }

      const permitMessage = {
        owner: address as `0x${string}`,
        spender: jaccardSwapAddr as `0x${string}`,
        value: amount,
        nonce: BigInt(tokenNonce as bigint),
        deadline,
      }

      const permitSig = await signTypedDataAsync({
        domain: permitDomain,
        types: ERC20PermitTypes,
        primaryType: 'Permit',
        message: permitMessage,
      })

      // Parse permit signature
      const permitR = permitSig.slice(0, 66) as `0x${string}`
      const permitS = ('0x' + permitSig.slice(66, 130)) as `0x${string}`
      const permitV = parseInt(permitSig.slice(130, 132), 16)

      // Now sign the bid
      const bidDomain = {
        name: EIP712_DOMAINS.JACCARD_SWAP,
        version: '1',
        chainId,
        verifyingContract: jaccardSwapAddr as `0x${string}`,
      }

      const bidMessage = {
        salt,
        deadline,
        targetMinHash: params.targetMinHash as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`],
        minMatches: params.minMatches,
        permit: {
          owner: address as `0x${string}`,
          spender: jaccardSwapAddr as `0x${string}`,
          value: amount,
          deadline,
          v: permitV,
          r: permitR,
          s: permitS,
        },
      }

      const bidSig = await signTypedDataAsync({
        domain: bidDomain,
        types: BidTypes,
        primaryType: 'Bid',
        message: bidMessage,
      })

      // Submit to API
      const response = await authFetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidder: address,
          chainId,
          amount: amount.toString(),
          targetMinHash: params.targetMinHash,
          minMatches: params.minMatches,
          desiredTraits: params.desiredTraits,
          salt,
          deadline: Number(deadline),
          signature: bidSig,
          erc20Permit: {
            owner: address,
            spender: jaccardSwapAddr,
            value: amount.toString(),
            deadline: Number(deadline),
            v: permitV,
            r: permitR,
            s: permitS,
          },
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create buy order')
      }

      setSuccess(true)
      return data.bid
    } catch (err) {
      console.error('Failed to create standing bid:', err)
      setError((err as Error).message)
      return null
    } finally {
      setIsPending(false)
    }
  }, [address, chainId, staticData, tokenNonce, signTypedDataAsync])

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
  }, [])

  return {
    createStandingBid,
    isPending,
    error,
    success,
    reset,
  }
}

