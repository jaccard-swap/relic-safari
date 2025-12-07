import { chats } from '@shared/database'
import { MSG, type MessageHandlerContext } from './types'
import { broadcastToRoom } from './rooms'

export async function handleChat(ctx: MessageHandlerContext, message: string): Promise<void> {
  ctx.log.info({ auctionId: ctx.auctionId, hasMessage: !!message, clientAddress: ctx.clientInfo?.address }, '💬 CHAT received')
  
  if (!message || !ctx.clientInfo?.address) {
    ctx.log.warn({ auctionId: ctx.auctionId, hasMessage: !!message, clientAddress: ctx.clientInfo?.address }, '❌ CHAT rejected')
    ctx.socket.send(JSON.stringify({ type: MSG.ERROR, error: 'Invalid chat or not identified' }))
    return
  }

  try {
    const [chat] = await ctx.db.insert(chats).values({
      auctionId: ctx.auctionId,
      sender: ctx.clientInfo.address,
      message,
    }).returning()

    ctx.log.info({ auctionId: ctx.auctionId, chatId: chat.id, sender: chat.sender }, '✅ Chat saved, broadcasting')
    
    broadcastToRoom(ctx.auctionId, {
      type: MSG.CHAT,
      id: chat.id,
      user: chat.sender,
      message: chat.message,
      timestamp: chat.createdAt.getTime(),
    })
  } catch (err) {
    ctx.log.error({ err }, 'Failed to save chat')
  }
}

