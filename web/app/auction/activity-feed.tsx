import { useEffect, useRef, useState } from "react";
import type { RoomEvent } from "../lib/use-auction-room";
import { EventItem } from "./event-item";

interface ActivityFeedProps {
  events: RoomEvent[];
  onSendChat: (message: string) => void;
  canChat: boolean;
}

export function ActivityFeed({ events, onSendChat, canChat }: ActivityFeedProps) {
  const [message, setMessage] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    onSendChat(trimmed);
    setMessage("");
  }

  return (
    <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-2">
      <h2 className="mb-1.5 text-xs font-semibold text-amber-300">📜 Activity</h2>
      <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-48 space-y-1 overflow-y-auto">
        {events.length === 0 && <div className="text-[9px] text-stone-500">No activity yet</div>}
        {events.map((event) => (
          <EventItem key={event.id} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>

      {canChat && (
        <form onSubmit={handleSend} className="mt-2 flex gap-1">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={280}
            placeholder="Say something…"
            className="flex-1 rounded border border-stone-700 bg-stone-900 px-2 py-1 text-[10px] text-stone-200 focus:border-amber-600 focus:outline-none"
          />
          <button type="submit" className="rounded bg-stone-700 px-2 py-1 text-[10px] text-stone-300 hover:bg-stone-600">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
