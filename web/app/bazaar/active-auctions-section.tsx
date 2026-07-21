import { useState } from "react";
import { CollapsibleSection } from "../components/collapsible-section";
import { ViewToggle, type CardView } from "../components/view-toggle";
import { useActiveAuctions } from "../lib/use-active-auctions";
import { AuctionCard } from "./auction-card";
import { AuctionTradingCard } from "./auction-trading-card";

interface ActiveAuctionsSectionProps {
  expanded: boolean;
  onToggle: () => void;
  onHelp: () => void;
}

export function ActiveAuctionsSection({ expanded, onToggle, onHelp }: ActiveAuctionsSectionProps) {
  const { data: auctions, isLoading, isError } = useActiveAuctions();
  const [view, setView] = useState<CardView>("list");

  return (
    <CollapsibleSection
      title="Active Auctions"
      icon="🏛️"
      expanded={expanded}
      onToggle={onToggle}
      onHelp={onHelp}
      summary={<span className="text-xs text-stone-500">{auctions?.length ?? 0} live</span>}
    >
      {isLoading && <div className="py-3 text-center text-[13px] text-stone-400">Loading auctions…</div>}
      {isError && <div className="py-3 text-center text-[13px] text-red-400">Failed to load auctions</div>}
      {!isLoading && !isError && (!auctions || auctions.length === 0) && (
        <div className="py-3 text-center text-[13px] text-stone-400">
          No active auctions
          <div className="mt-1 text-xs text-stone-500">List an artifact from your Vault to start one</div>
        </div>
      )}
      {auctions && auctions.length > 0 && (
        <div>
          <div className="mb-1.5 flex justify-end">
            <ViewToggle view={view} onChange={setView} />
          </div>
          {view === "list" ? (
            <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-56 space-y-1.5 overflow-y-auto">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          ) : (
            <div className="scrollbar-thin scrollbar-thumb-stone-700 flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {auctions.map((auction) => (
                <AuctionTradingCard key={auction.id} auction={auction} />
              ))}
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
