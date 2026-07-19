import { CollapsibleSection } from "../components/collapsible-section";
import { useActiveAuctions } from "../lib/use-active-auctions";
import { AuctionCard } from "./auction-card";

interface ActiveAuctionsSectionProps {
  expanded: boolean;
  onToggle: () => void;
  onHelp: () => void;
}

export function ActiveAuctionsSection({ expanded, onToggle, onHelp }: ActiveAuctionsSectionProps) {
  const { data: auctions, isLoading, isError } = useActiveAuctions();

  return (
    <CollapsibleSection
      title="Active Auctions"
      icon="🏛️"
      expanded={expanded}
      onToggle={onToggle}
      onHelp={onHelp}
      summary={<span className="text-[9px] text-stone-500">{auctions?.length ?? 0} live</span>}
    >
      {isLoading && <div className="py-2 text-center text-[10px] text-stone-400">Loading auctions…</div>}
      {isError && <div className="py-2 text-center text-[10px] text-red-400">Failed to load auctions</div>}
      {!isLoading && !isError && (!auctions || auctions.length === 0) && (
        <div className="py-2 text-center text-[10px] text-stone-400">
          No active auctions
          <div className="mt-0.5 text-[9px] text-stone-500">List an artifact from your Vault to start one</div>
        </div>
      )}
      {auctions && auctions.length > 0 && (
        <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-56 space-y-1 overflow-y-auto pt-1">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
