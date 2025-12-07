import { useState, useCallback } from 'react'
import { useConnection, useSignTypedData } from 'wagmi'
import { parseEther, toHex } from 'viem'
import { useStaticData } from './useStaticData'
import { AuctionTypes, JaccardERC1155PermitTypes, EIP712_DOMAINS } from '@shared/constants'

export interface AuctionFormData {
  title: string
  description?: string
  nftContract: string
  nftTokenId: string
  tokenContract: string
  startingBid: string
  durationHours: number
  // Optional: link to our DB NFT record
  nftId?: string
}

export interface AuctionPrefill {
  nftContract?: string
  nftTokenId?: string
  nftId?: string
  title?: string
}

// Helper to generate random salt (4 bytes)
function randomSalt(): `0x${string}` {
  return toHex(Math.floor(Math.random() * 0xffffffff), { size: 4 })
}

export function useCreateAuction() {
  const { address, chainId } = useConnection()
  const { staticData } = useStaticData()
  const { signTypedDataAsync } = useSignTypedData()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createAuction = useCallback(async (formData: AuctionFormData) => {
    if (!address || !chainId || !staticData) {
      throw new Error('Wallet not connected or static data not loaded')
    }

    setLoading(true)
    setError(null)

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + formData.durationHours * 3600)
      const reservePrice = parseEther(formData.startingBid)
      const nftContract = formData.nftContract as `0x${string}`
      const tokenContract = formData.tokenContract as `0x${string}`
      const jaccardSwapAddr = staticData.jaccardSwapAddr as `0x${string}`

      // 1. Sign NFT permit (JaccardERC1155Permit)
      const nftPermitData = {
        owner: address,
        spender: jaccardSwapAddr,
        tokenId: BigInt(formData.nftTokenId),
        amount: 1n,
        deadline,
        salt: randomSalt(),
      }

      const nftPermitSig = await signTypedDataAsync({
        domain: {
          name: EIP712_DOMAINS.JACCARD_ERC1155,
          version: '1',
          chainId,
          verifyingContract: nftContract,
        },
        types: JaccardERC1155PermitTypes,
        primaryType: 'JaccardERC1155Permit',
        message: nftPermitData,
      })

      // 2. Sign Auction (includes the NFT permit)
      const auctionData = {
        salt: randomSalt(),
        deadline,
        nft: nftContract,
        token: tokenContract,
        reservePrice,
        nftPermit: nftPermitData,
        nftPermitSignature: nftPermitSig,
      }

      const auctionSig = await signTypedDataAsync({
        domain: {
          name: EIP712_DOMAINS.JACCARD_SWAP,
          version: '1',
          chainId,
          verifyingContract: jaccardSwapAddr,
        },
        types: AuctionTypes,
        primaryType: 'Auction',
        message: auctionData,
      })

      console.log('📤 Submitting auction to API:', {
        salt: auctionData.salt,
        nftPermitSalt: nftPermitData.salt,
      })

      // 3. Submit to API
      const response = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          nftContract: formData.nftContract,
          nftTokenId: formData.nftTokenId,
          chainId,
          tokenContract: formData.tokenContract,
          startingBid: reservePrice.toString(),
          endTime: Number(deadline),
          auctioneer: address,
          // EIP-712 auction signature data (required for on-chain settlement)
          salt: auctionData.salt,
          signature: auctionSig,
          // NFT permit data for on-chain settlement
          nftPermit: {
            owner: nftPermitData.owner,
            spender: nftPermitData.spender,
            tokenId: nftPermitData.tokenId.toString(),
            amount: nftPermitData.amount.toString(),
            deadline: nftPermitData.deadline.toString(),
            salt: nftPermitData.salt,
          },
          nftPermitSignature: nftPermitSig,
          nftId: formData.nftId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create auction')
      }

      const data = await response.json()
      return data.auction
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create auction'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [address, chainId, staticData, signTypedDataAsync])

  return {
    createAuction,
    loading,
    error,
    isReady: !!address && !!chainId && !!staticData,
  }
}
