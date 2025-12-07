import { useState, useEffect, useCallback, useRef } from 'react'
import { useConnection } from 'wagmi'
import { WS_MSG as MSG } from '@shared/constants'
import type { Auction } from './useActiveAuctions'
import { authFetch } from '../lib/auth'

export interface ChatMessage {
  id: string
  user: string
  message: string
  timestamp: number
  type: 'message' | 'bid' | 'settled'
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
  messages: ChatMessage[]
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
    messages: [],
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
      
      // Find highest bid
      const highestBid = data.bids?.reduce((max: string, bid: any) => {
        return BigInt(bid.amount) > BigInt(max) ? bid.amount : max
      }, data.auction?.startingBid || '0')

      // Convert bids to messages
      const bidMessages: ChatMessage[] = (data.bids || []).map((bid: any) => ({
        id: bid.id,
        user: bid.bidder,
        message: bid.amount,
        timestamp: new Date(bid.createdAt).getTime(),
        type: 'bid' as const,
      }))

      // Convert chats to messages
      const chatMessages: ChatMessage[] = (data.chats || []).map((chat: any) => ({
        id: chat.id,
        user: chat.sender,
        message: chat.message,
        timestamp: new Date(chat.createdAt).getTime(),
        type: 'message' as const,
      }))

      // Merge and sort all messages
      const allMessages = [...bidMessages, ...chatMessages].sort((a, b) => a.timestamp - b.timestamp)

      setState(prev => ({
        ...prev,
        auction: data.auction,
        messages: allMessages,
        highBid: highestBid,
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

            case MSG.BID:
              const bidMsg: ChatMessage = {
                id: data.id || Date.now().toString(),
                user: data.bidder,
                message: data.amount,
                timestamp: data.timestamp || Date.now(),
                type: 'bid',
              }

              setState(prev => {
                const exists = prev.messages.some(m => m.id === bidMsg.id)
                if (exists) return prev

                const newHighBid = BigInt(data.amount) > BigInt(prev.highBid) 
                  ? data.amount 
                  : prev.highBid

                return {
                  ...prev,
                  messages: [...prev.messages, bidMsg].sort((a, b) => a.timestamp - b.timestamp),
                  highBid: newHighBid,
                }
              })
              break

            case MSG.CHAT:
              const chatMsg: ChatMessage = {
                id: data.id || Date.now().toString(),
                user: data.user,
                message: data.message,
                timestamp: data.timestamp || Date.now(),
                type: 'message',
              }

              setState(prev => {
                const exists = prev.messages.some(m => m.id === chatMsg.id)
                if (exists) return prev

                return {
                  ...prev,
                  messages: [...prev.messages, chatMsg].sort((a, b) => a.timestamp - b.timestamp),
                }
              })
              break

            case MSG.AUCTION_UPDATE:
              setState(prev => ({
                ...prev,
                auction: data.auction ? { ...prev.auction, ...data.auction } : prev.auction,
              }))
              break

            case MSG.SETTLED:
              console.log('🎉 Auction settled!', data)
              const settledMsg: ChatMessage = {
                id: `settled-${data.timestamp}`,
                user: 'system',
                message: `🎉 Auction settled! Winner: ${data.winner?.slice(0, 6)}...${data.winner?.slice(-4)}`,
                timestamp: data.timestamp,
                type: 'settled',
              }
              setState(prev => ({
                ...prev,
                messages: [...prev.messages, settledMsg],
                settled: {
                  auctionId: data.auctionId,
                  txHash: data.txHash,
                  winner: data.winner,
                  winningBid: data.winningBid,
                  timestamp: data.timestamp,
                },
              }))
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

  // Post a bid (via REST, server broadcasts to WS)
  interface BidData {
    amount: string
    salt: string
    deadline: number
    targetMinHash: [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]
    minMatches: number
    erc20Permit: {
      owner: string
      spender: string
      value: string
      deadline: string
      v: number
      r: string
      s: string
    }
    signature: string
  }

  const postBid = useCallback(async (bid: BidData) => {
    if (!auctionId || !address) {
      console.warn('postBid: missing auctionId or address')
      return
    }

    try {
      console.log('📤 Posting bid:', { auctionId, bidder: address, amount: bid.amount })
      
      const response = await authFetch(`/api/auction/${auctionId}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bidder: address,
          amount: bid.amount,
          salt: bid.salt,
          deadline: bid.deadline,
          targetMinHash: bid.targetMinHash,
          minMatches: bid.minMatches,
          erc20Permit: bid.erc20Permit,
          signature: bid.signature,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to place bid')
      }

      console.log('✅ Bid placed successfully')
      return true
    } catch (err) {
      console.error('Failed to post bid:', err)
      throw err
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
    postBid,
    refetch,
  }
}
