import { useState, useEffect, useCallback } from 'react'
import { useConnection, useChainId } from 'wagmi'

export interface PolymerizationRecord {
  id: string
  targetNftId: string
  consumedNftId: string
  upgradedTraits: Record<string, { from: string; to: string }>
  experienceGained: Record<string, number>
  essenceYield: number
  txHash: string | null
  status: string
  createdAt: string
  targetMetadata: Record<string, any> | null
  targetTokenId: string | null
}

export function usePolymerizationHistory(limit = 5) {
  const { address } = useConnection()
  const chainId = useChainId()
  const [history, setHistory] = useState<PolymerizationRecord[]>([])
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
      const res = await fetch(`/api/faucet/polymerase/history?address=${address}&chainId=${chainId}&limit=${limit}`, {
        credentials: 'include',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch history')
      }

      setHistory(data.history || [])
    } catch (err) {
      console.error('Failed to fetch polymerization history:', err)
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [address, chainId, limit])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { history, loading, error, refetch: fetchHistory }
}

