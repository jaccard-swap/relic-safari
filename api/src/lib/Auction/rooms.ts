import type { WebSocket } from '@fastify/websocket'
import { MSG, type Room } from './types'

// Global rooms map (per-auction)
const rooms = new Map<string, Room>()

// Global feed subscribers (for new auction notifications)
const feedSubscribers = new Set<WebSocket>()

export function getRoom(auctionId: string): Room {
  if (!rooms.has(auctionId)) {
    rooms.set(auctionId, new Map())
  }
  return rooms.get(auctionId)!
}

export function deleteRoom(auctionId: string): void {
  rooms.delete(auctionId)
}

export function getRoomSize(auctionId: string): number {
  return rooms.get(auctionId)?.size ?? 0
}

export function broadcastToRoom(auctionId: string, message: object, excludeSocket?: WebSocket): void {
  const room = rooms.get(auctionId)
  if (!room) return

  const payload = JSON.stringify(message)
  for (const [socket] of room) {
    if (socket !== excludeSocket && socket.readyState === 1) {
      socket.send(payload)
    }
  }
}

export function broadcastBid(auctionId: string, bid: { id: string; bidder: string; amount: string; timestamp: number }): void {
  broadcastToRoom(auctionId, { type: MSG.BID, ...bid })
}

// Feed management
export function subscribeFeed(socket: WebSocket): void {
  feedSubscribers.add(socket)
}

export function unsubscribeFeed(socket: WebSocket): void {
  feedSubscribers.delete(socket)
}

export function getFeedSize(): number {
  return feedSubscribers.size
}

export function broadcastToFeed(message: object, excludeSocket?: WebSocket): void {
  const payload = JSON.stringify(message)
  for (const socket of feedSubscribers) {
    if (socket !== excludeSocket && socket.readyState === 1) {
      socket.send(payload)
    }
  }
}

export function broadcastNewAuction(auction: object): void {
  broadcastToFeed({ type: MSG.NEW_AUCTION, auction, timestamp: Date.now() })
}

