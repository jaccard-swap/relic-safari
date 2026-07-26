import { useEffect, useRef } from "react";
import { useRecordClaim } from "./use-faucet-history";
import { InfoModal } from "../components/info-modal";
import { getExplorerTxUrl } from "../lib/explorer";

interface ClaimModalProps {
  open: boolean;
  onClose: () => void;
  chainId: number | undefined;
  hash: `0x${string}` | undefined;
  mintedAmount: string | null;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  refetchScrip: () => void;
  refetchLastClaim: () => void;
}

// Mirrors DigModal/FuseModal's popover treatment for the client-side SCRIP
// claim. No websocket room needed here - it's a direct wallet-signed tx, so
// wagmi's own pending/confirming/confirmed/error states drive the modal.
// refetchScrip is passed down from StipendSection rather than pulled from a
// second useBalances() instance here, so the refetch lands on the exact
// query observer feeding the visible balance instead of relying on a
// separate hook instance to share cache updates.
export function ClaimModal({ open, onClose, chainId, hash, mintedAmount, isPending, isConfirming, isConfirmed, error, refetchScrip, refetchLastClaim }: ClaimModalProps) {
  const recordClaim = useRecordClaim();
  const recordedHash = useRef<string | null>(null);

  useEffect(() => {
    if (isConfirmed && hash && mintedAmount && recordedHash.current !== hash) {
      recordedHash.current = hash;
      recordClaim.mutate({ txHash: hash, amount: mintedAmount });
      void refetchScrip();
    }
    // recordClaim/refetchScrip intentionally omitted - stable enough refs,
    // and including them would re-fire this on every unrelated status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed, hash, mintedAmount]);

  useEffect(() => {
    // A revert here means the on-chain cooldown state moved out from under
    // the proactive eligibility check (e.g. a second tab claimed first) -
    // refresh it so the Claim button's disabled/countdown state catches up
    // instead of staying stale and clickable.
    if (error) void refetchLastClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  if (!open) return null;

  const explorerUrl = chainId && hash ? getExplorerTxUrl(chainId, hash) : null;
  const formatted = mintedAmount ? (Number(mintedAmount) / 1e18).toFixed(2) : null;
  // isConfirmed flips as soon as the receipt lands, but mintedAmount comes
  // from a separate Transfer-event watcher that can arrive a beat later -
  // stay in the writing animation until both are ready, so we never render
  // a "+? SCRIP" placeholder.
  const showSuccess = isConfirmed && formatted !== null;
  const title = showSuccess ? "Claim Inscribed!" : error ? "Claim Failed" : "Inscribing...";
  const icon = showSuccess ? "📜" : error ? "⚠️" : "✏️";

  return (
    <InfoModal open={open} onClose={onClose} title={title} icon={icon}>
      {!showSuccess && !error && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative mx-auto h-10 w-20">
            <span className="absolute inset-x-0 bottom-1 text-2xl">📜</span>
            <span className="absolute left-1/2 top-0 -translate-x-1/2 text-xl [animation:pencil-write_1.1s_ease-in-out_infinite]">✏️</span>
            <span className="absolute bottom-2 left-1/2 h-0.5 -translate-x-1/2 bg-amber-400/70 [animation:ink-line_1.1s_ease-in-out_infinite]" />
          </div>
          <p className="text-center text-xs text-stone-400">{isPending ? "Confirm in your wallet" : isConfirming ? "Waiting for confirmation" : "Finalizing…"}</p>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 underline hover:text-amber-300">
              View pending transaction ↗
            </a>
          )}
        </div>
      )}

      {showSuccess && (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative w-full py-2">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-amber-400/40 blur-xl [animation:treasure-glow_1s_ease-out]" />
            </div>
            <div className="relative text-center text-2xl font-semibold text-amber-300 [animation:treasure-reveal_0.6s_ease-out]">
              +{formatted ?? "?"} SCRIP
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

      {error && (
        <div className="flex flex-col items-center gap-3 py-2">
          <span className="text-3xl">⚠️</span>
          <p className="text-center text-xs text-red-400">{error.message || "Claim failed"}</p>
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
