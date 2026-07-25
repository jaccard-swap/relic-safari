import { useEffect } from "react";
import { useNavigate } from "react-router";
import { InfoModal } from "../components/info-modal";
import { NftCard } from "../vault/nft-card";
import { useDigRoom } from "./use-dig-room";
import { useInvalidateNfts } from "../lib/use-nfts";
import { useBalances } from "../lib/use-balances";
import { getExplorerTxUrl } from "../lib/explorer";
import type { Erc1155FaucetResult } from "./use-erc1155-faucet";

interface DigModalProps {
  result: Erc1155FaucetResult | null;
  onClose: () => void;
}

// Tracks a dig from "hash in hand" through to the confirmed reveal (or a
// failure) via useDigRoom - see api/src/routes/faucet/index.ts for the
// server side of this split. Shares InfoModal's shell (backdrop, header,
// close button) rather than reinventing a modal wrapper.
export function DigModal({ result, onClose }: DigModalProps) {
  const navigate = useNavigate();
  const status = useDigRoom(result?.requestId ?? null);
  const invalidateNfts = useInvalidateNfts();
  const { refetchBalances } = useBalances();

  useEffect(() => {
    if (status.state === "success") {
      invalidateNfts();
      refetchBalances();
    }
  }, [status.state, invalidateNfts, refetchBalances]);

  if (!result) return null;

  const explorerUrl = getExplorerTxUrl(result.chainId, result.hash);
  const title = status.state === "success" ? "Artifact Uncovered!" : status.state === "failed" ? "Dig Failed" : "Digging...";
  const icon = status.state === "success" ? "✨" : status.state === "failed" ? "⚠️" : "⛏️";

  return (
    <InfoModal open={true} onClose={onClose} title={title} icon={icon}>
      {status.state === "pending" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="text-4xl [animation:dig-impact_1.4s_ease-in-out_infinite]">🪨</span>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl [animation:dig-spark_1.4s_ease-in-out_infinite]">✨</span>
            <span className="absolute -left-2 -top-2 origin-[85%_85%] text-4xl [animation:dig-strike_1.4s_ease-in-out_infinite]">⛏️</span>
          </div>
          <p className="text-center text-xs text-stone-400">Sponsoring your mint on-chain...</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline hover:text-amber-300">
              View pending transaction ↗
            </a>
          )}
        </div>
      )}

      {status.state === "success" && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-32 w-32 rounded-full bg-amber-400/40 blur-xl [animation:treasure-glow_1s_ease-out]" />
            </div>
            <div className="relative [animation:treasure-reveal_0.6s_ease-out]">
              <NftCard nft={status.nft} isExpanded onToggle={() => {}} onAuction={() => navigate(`/bazaar/create/${status.nft.id}`)} onShowDetails={() => {}} />
            </div>
          </div>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline hover:text-amber-300">
              View transaction ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="w-full rounded bg-amber-700/80 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-600">
            Nice!
          </button>
        </div>
      )}

      {status.state === "failed" && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-3xl">⚠️</span>
          <p className="text-center text-xs text-red-400">{status.error}</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline hover:text-amber-300">
              View transaction ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="w-full rounded bg-stone-700 py-2 text-xs font-medium text-white transition-colors hover:bg-stone-600">
            Close
          </button>
        </div>
      )}
    </InfoModal>
  );
}
