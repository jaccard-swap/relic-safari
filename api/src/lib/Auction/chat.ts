import { MSG, type MessageHandlerContext } from './types'
import { appendEvent } from './db'

export async function handleChat(ctx: MessageHandlerContext, message: string): Promise<void> {
  ctx.log.info({ auctionId: ctx.auctionId, hasMessage: !!message, clientAddress: ctx.clientInfo?.address }, '💬 CHAT received')
  
  if (!message || !ctx.clientInfo?.address) {
    ctx.log.warn({ auctionId: ctx.auctionId, hasMessage: !!message, clientAddress: ctx.clientInfo?.address }, '❌ CHAT rejected')
    ctx.socket.send(JSON.stringify({ type: MSG.ERROR, error: 'Invalid chat or not identified' }))
    return
  }

  try {
    // Append 'chat' event (broadcasts to room via appendEvent)
    await appendEvent(ctx.db, ctx.auctionId, 'chat', ctx.clientInfo.address, { message })
    ctx.log.info({ auctionId: ctx.auctionId, sender: ctx.clientInfo.address }, '✅ Chat event appended')
  } catch (err) {
    ctx.log.error({ err }, 'Failed to save chat')
  }
}

