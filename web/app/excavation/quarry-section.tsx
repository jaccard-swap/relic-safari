import { useEffect, useRef, useState } from "react";
import { useNfts } from "../lib/use-nfts";
import { useErc1155Faucet } from "./use-erc1155-faucet";
import { CollapsibleSection } from "../components/collapsible-section";
import { MiniNftCard } from "./mini-nft-card";
import { NftDetailModal } from "../components/nft-detail-modal";
import { Toast } from "../components/toast";
import type { Nft } from "../lib/use-nfts";
import { useAccount } from "wagmi";

interface QuarrySectionProps {
  expanded: boolean;
  onToggle: () => void;
  onHelp: () => void;
}

export function QuarrySection({ expanded, onToggle, onHelp }: QuarrySectionProps) {
  const { data: nfts = [] } = useNfts();
  const { isConnected } = useAccount();
  const [detailNft, setDetailNft] = useState<Nft | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastShown = useRef(false);

  const dig = useErc1155Faucet();

  useEffect(() => {
    if (dig.isSuccess && !toastShown.current) {
      toastShown.current = true;
      setToast({ message: "New artifact discovered! Check below ⛏️", type: "success" });
    }
    if (!dig.isSuccess) {
      toastShown.current = false;
    }
  }, [dig.isSuccess]);

  useEffect(() => {
    if (dig.isError) {
      setToast({ message: dig.error instanceof Error ? dig.error.message : "Excavation failed", type: "error" });
    }
  }, [dig.isError, dig.error]);

  return (
    <>
      <CollapsibleSection
        title="Quarry"
        icon="⛏️"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="text-[10px] text-stone-400">{nfts.length} artifacts found</span>
            <span className="text-[9px] text-stone-500">1/day</span>
          </>
        }
        action={
          <button
            type="button"
            onClick={() => dig.mutate()}
            disabled={!isConnected || dig.isPending}
            className="relative w-14 rounded bg-gradient-to-r from-stone-600 to-amber-800 py-1.5 text-center text-xs font-medium text-white transition-all hover:from-stone-500 hover:to-amber-700 disabled:opacity-50"
          >
            {dig.isPending ? "⏳" : dig.isError ? "✗" : "Dig"}
            {dig.isSuccess && <span className="absolute -right-1 -top-1 text-[10px] text-green-400">✓</span>}
          </button>
        }
      >
        <div className="mb-1 mt-2 text-[9px] text-stone-500">Recent Finds</div>
        {nfts.length === 0 ? (
          <div className="py-2 text-center text-[9px] text-stone-500">No artifacts yet</div>
        ) : (
          <div className="max-h-40 space-y-0.5 overflow-y-auto">
            {nfts.slice(0, 5).map((nft) => (
              <MiniNftCard key={nft.id} nft={nft} onClick={() => setDetailNft(nft)} />
            ))}
          </div>
        )}
      </CollapsibleSection>

      <NftDetailModal nft={detailNft} onClose={() => setDetailNft(null)} />

      {toast && <Toast message={toast.message} type={toast.type} duration={4000} onClose={() => setToast(null)} />}
    </>
  );
}
