import { useState } from "react";
import { useAccount } from "wagmi";
import { ViewToggle, type CardView } from "../components/view-toggle";
import { CreateAuctionModal } from "../components/create-auction-modal";
import { NftDetailModal } from "../components/nft-detail-modal";
import { useBalances } from "../lib/use-balances";
import { useNfts, type Nft } from "../lib/use-nfts";
import { NftCard } from "./nft-card";
import { TradingCard } from "../excavation/trading-card";

export function VaultPage() {
  const { isConnected } = useAccount();
  const { scripBalance, essenceBalance } = useBalances();
  const { data: nfts, isLoading, isError, refetch } = useNfts();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auctionNft, setAuctionNft] = useState<Nft | null>(null);
  const [detailNft, setDetailNft] = useState<Nft | null>(null);
  const [view, setView] = useState<CardView>("list");

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  if (!isConnected) {
    return (
      <div className="rounded border border-stone-700/50 bg-stone-800/30 p-4 text-center">
        <div className="text-[13px] text-stone-400">Connect a wallet to see your vault</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-around rounded-lg border border-amber-900/30 bg-stone-800/50 p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-amber-200">{scripBalance?.formatted?.toFixed(0) ?? "0"}</span>
          <span className="text-xs text-stone-500">💰 SCRIP</span>
        </div>
        <div className="h-4 w-px bg-stone-700" />
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-purple-300">{essenceBalance?.count ?? 0}</span>
          <span className="text-xs text-stone-500">✨ Essence</span>
        </div>
      </div>

      {isLoading && <div className="rounded bg-stone-800/30 p-3 text-center text-[13px] text-stone-400">Cataloguing artifacts…</div>}

      {isError && (
        <div className="rounded bg-red-900/20 p-3 text-center">
          <div className="text-[13px] text-red-400">Failed to load artifacts</div>
          <button type="button" onClick={() => refetch()} className="mt-1.5 text-xs text-stone-400 underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (!nfts || nfts.length === 0) && (
        <div className="rounded border border-stone-700/50 bg-stone-800/30 p-3 text-center">
          <div className="text-[13px] text-stone-400">No artifacts yet</div>
          <div className="mt-1 text-xs text-stone-500">Visit Excavation to uncover relics</div>
        </div>
      )}

      {nfts && nfts.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-0.5">
            <span className="text-[13px] font-medium text-stone-400">Artifacts</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500">{nfts.length} recovered</span>
              <ViewToggle view={view} onChange={setView} />
            </div>
          </div>

          {view === "list" ? (
            <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-96 space-y-1.5 overflow-y-auto">
              {nfts.map((nft) => (
                <NftCard
                  key={nft.id}
                  nft={nft}
                  isExpanded={expandedId === nft.id}
                  onToggle={() => toggleExpand(nft.id)}
                  onAuction={() => setAuctionNft(nft)}
                  onShowDetails={() => setDetailNft(nft)}
                />
              ))}
            </div>
          ) : (
            <div className="scrollbar-thin scrollbar-thumb-stone-700 flex max-h-96 flex-wrap gap-2 overflow-y-auto">
              {nfts.map((nft) => (
                <div key={nft.id} className="relative">
                  <TradingCard nft={nft} onClick={() => setDetailNft(nft)} />
                  <button
                    type="button"
                    onClick={() => setAuctionNft(nft)}
                    title="Auction"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-700/80 text-xs text-white transition-colors hover:bg-amber-600"
                  >
                    🏛️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CreateAuctionModal nft={auctionNft} onClose={() => setAuctionNft(null)} />
      <NftDetailModal nft={detailNft} onClose={() => setDetailNft(null)} />
    </div>
  );
}
