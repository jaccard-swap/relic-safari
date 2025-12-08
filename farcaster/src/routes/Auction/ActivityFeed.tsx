import { useRef, useEffect } from 'react'
import type { Chain } from 'viem'
import { MessageItem } from './MessageItem'
import type { ChatMessage } from '../../hooks/useAuctionRoom'

interface ActivityFeedProps {
  messages: ChatMessage[]
  address?: string
  chain?: Chain
  chatInput: string
  onChatInputChange: (value: string) => void
  onSendMessage: (e: React.FormEvent) => void
}

export function ActivityFeed({
  messages,
  address,
  chain,
  chatInput,
  onChatInputChange,
  onSendMessage,
}: ActivityFeedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="bg-stone-800/50 border border-amber-900/30 rounded-lg overflow-hidden">
      <div className="px-2 py-1.5 border-b border-stone-700/50 flex items-center justify-between">
        <span className="text-[10px] font-medium text-stone-400">Activity</span>
        <span className="text-[9px] text-stone-500">{messages.length}</span>
      </div>
      
      <div className="h-40 overflow-y-auto p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-stone-700">
        {messages.length === 0 ? (
          <div className="text-center text-stone-500 text-[10px] py-6">No activity yet</div>
        ) : (
          messages.map((msg) => (
            <MessageItem 
              key={msg.id} 
              msg={msg} 
              isOwn={msg.user.toLowerCase() === address?.toLowerCase()}
              chain={chain}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={onSendMessage} className="p-1.5 border-t border-stone-700/50">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            placeholder="Comment..."
            className="flex-1 px-2 py-1 bg-stone-900/50 border border-stone-700 rounded text-[10px] text-white placeholder-stone-500 focus:outline-none focus:border-amber-700"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="px-2 py-1 bg-stone-700 hover:bg-stone-600 disabled:bg-stone-800 disabled:text-stone-600 text-white text-[10px] font-medium rounded transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
