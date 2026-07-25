import type { WebSocket } from '@fastify/websocket'

// One-shot version of Auction/rooms.ts's room pattern: a dig request has
// exactly one terminal event (mint confirmed or failed), not an ongoing
// conversation, so there's no join/leave broadcast or chat - just "wait for
// one message then tear down."
const digRooms = new Map<string, Set<WebSocket>>()

export function joinDigRoom(requestId: string, socket: WebSocket): void {
  if (!digRooms.has(requestId)) {
    digRooms.set(requestId, new Set())
  }
  digRooms.get(requestId)!.add(socket)
}

export function leaveDigRoom(requestId: string, socket: WebSocket): void {
  const room = digRooms.get(requestId)
  if (!room) return
  room.delete(socket)
  if (room.size === 0) digRooms.delete(requestId)
}

// Terminal event - sends to whoever's connected right now and tears the
// room down immediately after, since no further messages will ever follow
// for this requestId.
export function broadcastDigStatus(requestId: string, message: object): void {
  const room = digRooms.get(requestId)
  if (!room) return

  const payload = JSON.stringify(message)
  for (const socket of room) {
    if (socket.readyState === 1) socket.send(payload)
  }
  digRooms.delete(requestId)
}
