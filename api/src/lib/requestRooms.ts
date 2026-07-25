import type { WebSocket } from '@fastify/websocket'

// One-shot room pattern shared by any request that has exactly one terminal
// event (a sponsored mint confirms/fails, a fusion confirms/fails) rather
// than an ongoing conversation like Auction/rooms.ts - so there's no
// join/leave broadcast or chat, just "wait for one message then tear down."
// Keyed by an opaque requestId (a row id from whichever table owns the
// request), shared across request kinds since those ids never collide.
const requestRooms = new Map<string, Set<WebSocket>>()

export function joinRequestRoom(requestId: string, socket: WebSocket): void {
  if (!requestRooms.has(requestId)) {
    requestRooms.set(requestId, new Set())
  }
  requestRooms.get(requestId)!.add(socket)
}

export function leaveRequestRoom(requestId: string, socket: WebSocket): void {
  const room = requestRooms.get(requestId)
  if (!room) return
  room.delete(socket)
  if (room.size === 0) requestRooms.delete(requestId)
}

// Terminal event - sends to whoever's connected right now and tears the
// room down immediately after, since no further messages will ever follow
// for this requestId.
export function broadcastRequestStatus(requestId: string, message: object): void {
  const room = requestRooms.get(requestId)
  if (!room) return

  const payload = JSON.stringify(message)
  for (const socket of room) {
    if (socket.readyState === 1) socket.send(payload)
  }
  requestRooms.delete(requestId)
}
