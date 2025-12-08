import { useState, useEffect, useCallback } from 'react'
import { useConnection, useChainId } from 'wagmi'
import { authFetch } from '../lib/auth'

export interface Erc20ClaimRecord {
  id: string
  amount: string
  txHash: string
  chainId: number
  createdAt: string
}

export function useFaucetHistory(limit = 5) {
  const { address } = useConnection()
  const chainId = useChainId()
  const [history, setHistory] = useState<Erc20ClaimRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!address) {
      setHistory([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await authFetch(`/api/faucet/erc20/history?address=${address}&chainId=${chainId}&limit=${limit}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch history')
      }

      setHistory(data.history || [])
    } catch (err) {
      console.error('Failed to fetch faucet history:', err)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [address, chainId, limit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Record a new claim
  const recordClaim = useCallback(async (txHash: string, amount: string) => {
    if (!address || !chainId) return

    try {
      const res = await authFetch('/api/faucet/erc20/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: address,
          chainId,
          amount,
          txHash,
        }),
      })

      if (res.ok) {
        // Refetch to get updated list
        fetchHistory()
      }
    } catch (err) {
      console.error('Failed to record claim:', err)
    }
  }, [address, chainId, fetchHistory])

  return { history, loading, error, refetch: fetchHistory, recordClaim }
}
