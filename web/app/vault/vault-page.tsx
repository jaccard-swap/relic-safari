import { useState } from "react";
import { useAccount } from "wagmi";
import { CreateAuctionModal } from "../components/create-auction-modal";
import { NftDetailModal } from "../components/nft-detail-modal";
import { useBalances } from "../lib/use-balances";
import { useNfts, type Nft } from "../lib/use-nfts";
import { NftCard } from "./nft-card";

export function VaultPage() {
  const { isConnected } = useAccount();
  const { scripBalance, essenceBalance } = useBalances();
  const { data: nfts, isLoading, isError, refetch } = useNfts();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auctionNft, setAuctionNft] = useState<Nft | null>(null);
  const [detailNft, setDetailNft] = useState<Nft | null>(null);

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  if (!isConnected) {
    return (
      <div className="rounded border border-stone-700/50 bg-stone-800/30 p-3 text-center">
        <div className="text-[10px] text-stone-400">Connect a wallet to see your vault</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-around rounded-lg border border-amber-900/30 bg-stone-800/50 p-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-amber-200">{scripBalance?.formatted?.toFixed(0) ?? "0"}</span>
          <span className="text-[9px] text-stone-500">💰 SCRIP</span>
        </div>
        <div className="h-4 w-px bg-stone-700" />
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-sm text-purple-300">{essenceBalance?.count ?? 0}</span>
          <span className="text-[9px] text-stone-500">✨ Essence</span>
        </div>
      </div>

      {isLoading && <div className="rounded bg-stone-800/30 p-2 text-center text-[10px] text-stone-400">Cataloguing artifacts…</div>}

      {isError && (
        <div className="rounded bg-red-900/20 p-2 text-center">
          <div className="text-[10px] text-red-400">Failed to load artifacts</div>
          <button type="button" onClick={() => refetch()} className="mt-1 text-[9px] text-stone-400 underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (!nfts || nfts.length === 0) && (
        <div className="rounded border border-stone-700/50 bg-stone-800/30 p-2 text-center">
          <div className="text-[10px] text-stone-400">No artifacts yet</div>
          <div className="mt-0.5 text-[9px] text-stone-500">Visit Excavation to uncover relics</div>
        </div>
      )}

      {nfts && nfts.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between px-0.5">
            <span className="text-[10px] font-medium text-stone-400">Artifacts</span>
            <span className="text-[9px] text-stone-500">{nfts.length} recovered</span>
          </div>
          <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-96 space-y-1 overflow-y-auto">
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
        </div>
      )}

      <CreateAuctionModal nft={auctionNft} onClose={() => setAuctionNft(null)} />
      <NftDetailModal nft={detailNft} onClose={() => setDetailNft(null)} />
    </div>
  );
}
