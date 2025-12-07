import { MSG, type MessageHandlerContext } from './types'

export function handlePing(ctx: MessageHandlerContext): void {
  ctx.socket.send(JSON.stringify({ type: MSG.PONG, timestamp: Date.now() }))
}

export function handleJoin(ctx: MessageHandlerContext, address?: string): void {
  if (address && ctx.clientInfo) {
    ctx.clientInfo.address = address
    ctx.log.info({ auctionId: ctx.auctionId, address }, '✅ Client identified')
  } else {
    ctx.log.warn({ auctionId: ctx.auctionId, address, hasClientInfo: !!ctx.clientInfo }, '⚠️ JOIN failed')
  }
}

