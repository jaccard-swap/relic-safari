import { useEffect } from 'react'
import { useStore } from '@tanstack/react-store'
import { useConnection } from 'wagmi'
import { nftStore, activeNfts, fetchNfts, clearNfts, invalidateNfts } from '../stores/nftStore'

// Re-export types from store
export type { Nft, NftMetadata } from '../stores/nftStore'

export function useMyNfts() {
  const { address, chainId } = useConnection()
  
  const nfts = useStore(activeNfts)
  const loading = useStore(nftStore, s => s.loading)
  const error = useStore(nftStore, s => s.error)

  // Fetch when address/chainId changes
  useEffect(() => {
    if (address) {
      fetchNfts(address, chainId)
    } else {
      clearNfts()
    }
  }, [address, chainId])

  return {
    nfts,
    loading,
    error,
    refetch: invalidateNfts,
  }
}
