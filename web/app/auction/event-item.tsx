import { formatEther } from "viem";
import type { RoomEvent } from "../lib/use-auction-room";

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function scrip(value: unknown): string {
  if (typeof value !== "string") return "0";
  try {
    return parseFloat(formatEther(BigInt(value))).toFixed(2);
  } catch {
    return "0";
  }
}

interface EventItemProps {
  event: RoomEvent;
}

export function EventItem({ event }: EventItemProps) {
  const time = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let content: React.ReactNode;
  switch (event.type) {
    case "created":
      content = <>🏛️ Auction created</>;
      break;
    case "bid":
      content = (
        <>
          <span className="text-amber-300">{short(event.actor)}</span> bid <span className="text-amber-200">{scrip(event.summary?.amount)}</span> SCRIP
        </>
      );
      break;
    case "chat":
      content = (
        <>
          <span className="text-stone-400">{short(event.actor)}:</span> {String(event.summary?.message ?? "")}
        </>
      );
      break;
    case "settled":
      content = (
        <>
          🎉 Settled — <span className="text-emerald-300">{short(event.actor)}</span> won for {scrip(event.summary?.amount)} SCRIP
        </>
      );
      break;
    case "cancelled":
      content = <>Auction cancelled</>;
      break;
    default:
      content = <>{event.type}</>;
  }

  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="shrink-0 text-stone-600">{time}</span>
      <span className="text-stone-300">{content}</span>
    </div>
  );
}
