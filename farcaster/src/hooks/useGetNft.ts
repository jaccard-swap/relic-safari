import { useState, useEffect, useCallback } from 'react'
import type { Nft } from '../stores/nftStore'

export function useGetNft(nftId: string | undefined) {
  const [nft, setNft] = useState<Nft | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNft = useCallback(async () => {
    if (!nftId) {
      setNft(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/nft/${nftId}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch NFT')
      }

      const data = await response.json()
      setNft(data.nft || null)
    } catch (err) {
      setError((err as Error).message)
      setNft(null)
    } finally {
      setLoading(false)
    }
  }, [nftId])

  useEffect(() => {
    fetchNft()
  }, [fetchNft])

  return {
    nft,
    loading,
    error,
    refetch: fetchNft,
  }
}

