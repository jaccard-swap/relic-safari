import { useState, useEffect, useRef, useCallback } from 'react'
import { useConnection } from 'wagmi'
import { WS_MSG as MSG } from '@shared/constants'

export interface Auction {
  id: string
  title: string
  description?: string
  nftId?: string
  nftContract: string
  nftTokenId: string
  chainId: number
  tokenContract: string
  startingBid: string
  endTime: string
  auctioneer: string
  status: string
  winner?: string
  winningBid?: string
  createdAt: string
}

export function useActiveAuctions() {
  const { chainId } = useConnection()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/auction/feed`
    
    console.log('🔌 Connecting to auction feed:', wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('🔌 Auction feed connected')
      setConnected(true)
      setError(null)

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: MSG.PING }))
        }
      }, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case MSG.AUCTIONS_LIST:
            console.log('📋 Received auctions list:', data.auctions?.length)
            // Filter by chain if connected
            const filtered = chainId 
              ? data.auctions.filter((a: Auction) => a.chainId === chainId)
              : data.auctions
            setAuctions(filtered)
            setLoading(false)
            break

          case MSG.NEW_AUCTION:
            console.log('🆕 New auction:', data.auction?.title)
            // Only add if matches current chain (or no chain filter)
            if (!chainId || data.auction.chainId === chainId) {
              setAuctions(prev => {
                // Avoid duplicates
                if (prev.some(a => a.id === data.auction.id)) return prev
                return [data.auction, ...prev]
              })
            }
            break

          case MSG.PONG:
            // Heartbeat response
            break
        }
      } catch (err) {
        console.error('Failed to parse feed message:', err)
      }
    }

    ws.onclose = () => {
      console.log('🔌 Auction feed disconnected')
      setConnected(false)
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(connectWs, 3000)
    }

    ws.onerror = (err) => {
      console.error('Auction feed error:', err)
      setError('Connection error')
    }
  }, [chainId])

  // Cleanup
  useEffect(() => {
    connectWs()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [connectWs])

  // Manual refetch via REST (fallback)
  const refetch = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (chainId) params.set('chainId', chainId.toString())
      params.set('status', 'active')

      const response = await fetch(`/api/auction?${params}`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch auctions')

      const data = await response.json()
      setAuctions(data.auctions || [])
    } catch (err) {
      console.error('Failed to refetch auctions:', err)
    }
  }, [chainId])

  return {
    auctions,
    loading,
    error,
    connected,
    refetch,
  }
}
