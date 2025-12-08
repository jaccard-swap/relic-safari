import { useState, useEffect, useCallback, useRef } from 'react'
import { useConnection } from 'wagmi'
import { WS_MSG as MSG } from '@shared/constants'
import type { Auction } from './useActiveAuctions'
import { authFetch } from '../lib/auth'

// Unified event from append-only log
export interface AuctionEvent {
  id: string
  type: 'created' | 'bid' | 'chat' | 'settled' | 'cancelled'
  actor: string
  summary: {
    amount?: string
    message?: string
    txHash?: string
    winner?: string
  }
  timestamp: number
}

export interface SettledData {
  auctionId: string
  txHash: string
  winner?: string
  winningBid?: string
  timestamp: number
}

export interface AuctionRoomState {
  auction: Auction | null
  events: AuctionEvent[]
  highBid: string
  loading: boolean
  error: string | null
  connected: boolean
  participantCount: number
  settled: SettledData | null
}

export function useAuctionRoom(auctionId: string | undefined) {
  const { address } = useConnection()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [state, setState] = useState<AuctionRoomState>({
    auction: null,
    events: [],
    highBid: '0',
    loading: true,
    error: null,
    connected: false,
    participantCount: 0,
    settled: null,
  })

  // Fetch auction data
  const fetchAuction = useCallback(async () => {
    if (!auctionId) return

    try {
      const response = await authFetch(`/api/auction/${auctionId}`)
      if (!response.ok) throw new Error('Failed to fetch auction')
      
      const data = await response.json()
      
      // Convert events from API
      const events: AuctionEvent[] = (data.events || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        actor: e.actor,
        summary: e.summary || {},
        timestamp: new Date(e.createdAt).getTime(),
      }))

      setState(prev => ({
        ...prev,
        auction: data.auction,
        events,
        highBid: data.highestBid || data.auction?.startingBid || '0',
        loading: false,
        error: null,
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load auction',
      }))
    }
  }, [auctionId])

  // Connect websocket
  const connectWs = useCallback(() => {
    if (!auctionId || wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/auction/${auctionId}/room`

    console.log('🔌 Connecting to:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('🔌 Auction room connected')
        setState(prev => ({ ...prev, connected: true, error: null }))
        
        // Identify ourselves
        if (address) {
          console.log('📤 Identifying with address:', address)
          ws.send(JSON.stringify({ type: MSG.JOIN, address }))
        } else {
          console.warn('🔌 Connected but no address to identify with')
        }

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
          console.log('📨 WS:', data.type, data)

          switch (data.type) {
            case MSG.JOINED:
            case MSG.LEFT:
              setState(prev => ({ 
                ...prev, 
                participantCount: data.count || prev.participantCount 
              }))
              break

            case MSG.EVENT:
              const evt: AuctionEvent = {
                id: data.event.id,
                type: data.event.type,
                actor: data.event.actor,
                summary: data.event.summary || {},
                timestamp: data.event.timestamp,
              }

              setState(prev => {
                const exists = prev.events.some(e => e.id === evt.id)
                if (exists) return prev

                // Update highBid if this is a bid event
                let newHighBid = prev.highBid
                if (evt.type === 'bid' && evt.summary.amount) {
                  if (BigInt(evt.summary.amount) > BigInt(prev.highBid)) {
                    newHighBid = evt.summary.amount
                  }
                }

                // Track settled state
                let settled = prev.settled
                if (evt.type === 'settled') {
                  settled = {
                    auctionId: auctionId!,
                    txHash: evt.summary.txHash || '',
                    winner: evt.summary.winner,
                    winningBid: evt.summary.amount,
                    timestamp: evt.timestamp,
                  }
                }

                return {
                  ...prev,
                  events: [...prev.events, evt].sort((a, b) => a.timestamp - b.timestamp),
                  highBid: newHighBid,
                  settled,
                }
              })
              break

            case MSG.ERROR:
              console.error('❌ Server error:', data.error)
              break
          }
        } catch (err) {
          console.error('Failed to parse WS message:', err)
        }
      }

      ws.onclose = () => {
        console.log('🔌 WS disconnected')
        setState(prev => ({ ...prev, connected: false }))
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Reconnect after 3s
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000)
      }

      ws.onerror = (err) => {
        console.error('WS error:', err)
      }
    } catch (err) {
      console.error('Failed to connect WS:', err)
    }
  }, [auctionId, address])

  // Send chat message via websocket
  const postChatMessage = useCallback(async (message: string) => {
    if (!auctionId) {
      console.warn('postChatMessage: no auctionId')
      return
    }
    if (!address) {
      console.warn('postChatMessage: no address (wallet not connected)')
      return
    }

    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) {
      console.log('📤 Sending chat:', { message, address })
      ws.send(JSON.stringify({ type: MSG.CHAT, message }))
    } else {
      console.warn('WS not connected, cannot send chat. readyState:', ws?.readyState)
    }
  }, [auctionId, address])

  // Refetch auction data
  const refetch = useCallback(() => {
    fetchAuction()
  }, [fetchAuction])

  // Initialize
  useEffect(() => {
    if (!auctionId) return

    fetchAuction()
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
  }, [auctionId, fetchAuction, connectWs])

  // Re-identify when address changes
  useEffect(() => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN && address) {
      console.log('📤 Re-identifying with address:', address)
      ws.send(JSON.stringify({ type: MSG.JOIN, address }))
    }
  }, [address])

  return {
    ...state,
    postChatMessage,
    refetch,
  }
}
