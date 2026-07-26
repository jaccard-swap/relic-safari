import { formatEther } from "viem";
import { InfoModal } from "../components/info-modal";
import { getExplorerTxUrl } from "../lib/explorer";
import type { ConsumeResult } from "../lib/use-consume-auction";

function short(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type ConsumeStatus = "idle" | "loading" | "confirming" | "recording" | "success" | "error";

interface ConsumeModalProps {
  open: boolean;
  onClose: () => void;
  chainId: number;
  hash: `0x${string}` | undefined;
  status: ConsumeStatus;
  result: ConsumeResult | null;
  error: string | null;
}

// Mirrors ClaimModal's popover treatment for another direct wallet-signed tx
// - no websocket room needed, useConsumeAuction's own status/hash/result
// state drives the modal straight through the wallet signature,
// confirmation, and recording the settlement with the API. Reuses the same
// dig-strike/dig-spark/treasure-glow/treasure-reveal keyframes as
// DigModal/FuseModal/ClaimModal for a consistent "in progress" / "revealed"
// visual language across the app rather than inventing a fourth set.
export function ConsumeModal({ open, onClose, chainId, hash, status, result, error }: ConsumeModalProps) {
  if (!open) return null;

  const explorerUrl = hash ? getExplorerTxUrl(chainId, hash) : null;
  const showSuccess = status === "success" && !!result;
  const showError = status === "error" && !!error;
  const winningBidFormatted = result ? parseFloat(formatEther(BigInt(result.winningBid))).toFixed(2) : null;
  const title = showSuccess ? "Auction Settled!" : showError ? "Settlement Failed" : "Settling...";
  const icon = showSuccess ? "🏆" : showError ? "⚠️" : "🔨";

  return (
    <InfoModal open={open} onClose={onClose} title={title} icon={icon}>
      {!showSuccess && !showError && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="text-3xl">🪙</span>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl [animation:dig-spark_1.4s_ease-in-out_infinite]">✨</span>
            <span className="absolute -left-1 -top-3 origin-[80%_80%] text-3xl [animation:dig-strike_1.4s_ease-in-out_infinite]">🔨</span>
          </div>
          <p className="text-center text-xs text-stone-400">
            {status === "loading" ? "Confirm in your wallet" : status === "confirming" ? "Waiting for confirmation" : "Recording settlement…"}
          </p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline hover:text-amber-300">
              View pending transaction ↗
            </a>
          )}
        </div>
      )}

      {showSuccess && result && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative w-full py-2">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-emerald-400/40 blur-xl [animation:treasure-glow_1s_ease-out]" />
            </div>
            <div className="relative text-center [animation:treasure-reveal_0.6s_ease-out]">
              <div className="text-2xl font-semibold text-emerald-300">{winningBidFormatted} SCRIP</div>
              <div className="mt-1 text-xs text-stone-400">Won by {short(result.winner)}</div>
            </div>
          </div>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline hover:text-amber-300">
              View transaction ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="w-full rounded bg-emerald-700/80 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600">
            Nice!
          </button>
        </div>
      )}

      {showError && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-3xl">⚠️</span>
          <p className="text-center text-xs text-red-400">{error}</p>
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
