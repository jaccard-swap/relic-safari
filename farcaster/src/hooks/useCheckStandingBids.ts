import { useState, useEffect } from 'react'

export function useCheckStandingBids(auctionId: string | undefined, connected: boolean) {
  const [matchedCount, setMatchedCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!auctionId || !connected) return
    
    let cancelled = false
    setLoading(true)
    
    const check = async () => {
      try {
        const response = await fetch(`/api/auction/${auctionId}/check-bids`, {
          method: 'POST',
          credentials: 'include',
        })
        
        if (cancelled) return
        
        if (!response.ok) {
          console.error('check-bids failed:', response.status)
          return
        }
        
        const data = await response.json()
        if (!data.error && !data.skipped) {
          setMatchedCount(data.count ?? 0)
        }
      } catch (err) {
        console.error('Failed to check standing bids:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    
    // Small delay to let room fully connect
    const timeout = setTimeout(check, 500)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [auctionId, connected])

  return { matchedCount, loading }
}

