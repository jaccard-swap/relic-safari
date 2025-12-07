import { useState, useEffect, useCallback } from 'react'
import { useConnection } from 'wagmi'

export interface StandingBid {
  id: string
  bidder: string
  chainId: number
  amount: string
  targetMinHash: string[]
  minMatches: number
  desiredTraits: Record<string, string>
  deadline: string
  status: string
  matchedAuctionId: string | null
  createdAt: string
}

export function useStandingBids() {
  const { address, chainId } = useConnection()
  const [bids, setBids] = useState<StandingBid[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBids = useCallback(async () => {
    if (!address) {
      setBids([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        bidder: address,
        status: 'active',
      })
      if (chainId) {
        params.set('chainId', String(chainId))
      }

      const response = await fetch(`/api/bids?${params}`, {
        credentials: 'include',
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch bids')
      }

      setBids(data.bids || [])
    } catch (err) {
      console.error('Failed to fetch standing bids:', err)
      setError((err as Error).message)
      setBids([])
    } finally {
      setLoading(false)
    }
  }, [address, chainId])

  // Fetch on mount and when address/chain changes
  useEffect(() => {
    fetchBids()
  }, [fetchBids])

  return {
    bids,
    loading,
    error,
    refetch: fetchBids,
  }
}

