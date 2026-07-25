import { useCallback, useEffect, useRef, useState } from "react";
import { useBalances } from "../lib/use-balances";
import { useFaucetHistory, useRecordClaim } from "./use-faucet-history";
import { useErc20Faucet } from "./use-erc20-faucet";
import { CollapsibleSection } from "../components/collapsible-section";
import { Toast } from "../components/toast";
import { getExplorerUrlForChain } from "../lib/explorer";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

interface StipendSectionProps {
  expanded: boolean;
  onToggle: () => void;
  onHelp: () => void;
}

export function StipendSection({ expanded, onToggle, onHelp }: StipendSectionProps) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastShown = useRef(false);

  const { scripBalance, refetchScrip, isConnected } = useBalances();
  const { data: history = [] } = useFaucetHistory();
  const recordClaim = useRecordClaim();

  const { claimFaucetErc20, hash: claimHash, mintedAmount, isPending: claimPending, isConfirming: claimConfirming, isConfirmed: claimConfirmed, error: claimError } =
    useErc20Faucet();

  const handleClaim = useCallback(() => {
    claimFaucetErc20();
  }, [claimFaucetErc20]);

  useEffect(() => {
    if (claimConfirmed && claimHash && mintedAmount && !toastShown.current) {
      toastShown.current = true;
      const formatted = (Number(mintedAmount) / 1e18).toFixed(2);
      setToast({ message: `Claimed ${formatted} SCRIP!`, type: "success" });
      recordClaim.mutate({ txHash: claimHash, amount: mintedAmount });
      void refetchScrip();
    }
    if (!claimConfirmed) {
      toastShown.current = false;
    }
    // recordClaim intentionally omitted - it's a stable mutate() reference and
    // including the mutation object would re-fire this effect on every status change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimConfirmed, claimHash, mintedAmount, refetchScrip]);

  useEffect(() => {
    if (claimError) {
      const msg = claimError.message?.includes("Rate limited") ? "Rate limited: wait 12 hours" : claimError.message || "Claim failed";
      setToast({ message: msg, type: "error" });
    }
  }, [claimError]);

  return (
    <>
      <CollapsibleSection
        title="Explorer's Stipend"
        icon="💰"
        expanded={expanded}
        onToggle={onToggle}
        onHelp={onHelp}
        summary={
          <>
            <span className="font-mono text-sm text-amber-200">{scripBalance?.formatted?.toFixed(2) ?? "0.00"}</span>
            <span className="text-xs text-stone-500">SCRIP</span>
          </>
        }
        action={
          <button
            type="button"
            onClick={handleClaim}
            disabled={!isConnected || claimPending || claimConfirming}
            className="relative w-14 rounded bg-gradient-to-r from-amber-600 to-yellow-700 py-2 text-center text-xs font-medium text-white transition-all hover:from-amber-500 hover:to-yellow-600 disabled:opacity-50"
          >
            {claimPending ? "✍️" : claimConfirming ? "⏳" : claimError ? "✗" : "Claim"}
            {claimConfirmed && <span className="absolute -right-1 -top-1.5 text-[13px] text-green-400">✓</span>}
          </button>
        }
      >
        {(claimPending || claimConfirming) && (
          <div className="mt-3 rounded border border-amber-500/50 bg-amber-950/40 p-3 text-center">
            <div className="relative mx-auto mb-1 h-10 w-20">
              <span className="absolute inset-x-0 bottom-1 text-2xl">📜</span>
              <span className="absolute left-1/2 top-0 -translate-x-1/2 text-xl [animation:pencil-write_1.1s_ease-in-out_infinite]">✏️</span>
              <span className="absolute bottom-2 left-1/2 h-0.5 -translate-x-1/2 bg-amber-400/70 [animation:ink-line_1.1s_ease-in-out_infinite]" />
            </div>
            <div className="text-sm text-amber-400">{claimPending ? "Signing…" : "Inscribing your claim…"}</div>
            <div className="text-xs text-stone-400">{claimPending ? "Confirm in your wallet" : "Waiting for confirmation"}</div>
          </div>
        )}

        <div className="mt-3 space-y-1 rounded border border-stone-700/50 bg-stone-800/50 px-2 py-2 text-xs text-stone-500">
          <div>
            <span className="text-amber-400">1st claim:</span> ~5.24 SCRIP (φ²)
          </div>
          <div>
            <span className="text-amber-400">Next 3:</span> ~1.62 SCRIP each (φ)
          </div>
          <div className="text-stone-600">Resets every 12 hours</div>
        </div>
        <div className="mb-1.5 mt-3 text-xs text-stone-500">Recent Claims</div>
        <div className="space-y-1">
          {history.length === 0 ? (
            <div className="py-1.5 text-xs text-stone-600">No claims yet</div>
          ) : (
            history.map((h) => {
              const txUrl = getExplorerUrlForChain(h.chainId, h.txHash, "transaction");
              const displayAmount = Math.floor(Number(BigInt(h.amount) / BigInt(10 ** 18)));
              return (
                <div key={h.txHash} className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-400">{formatTimeAgo(h.createdAt)}</span>
                    {txUrl ? (
                      <a href={txUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-stone-500 hover:text-amber-300">
                        {h.txHash.slice(0, 6)}...{h.txHash.slice(-4)} ↗
                      </a>
                    ) : (
                      <span className="font-mono text-stone-500">
                        {h.txHash.slice(0, 6)}...{h.txHash.slice(-4)}
                      </span>
                    )}
                  </div>
                  <span className="text-amber-300">+{displayAmount.toLocaleString()}</span>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSection>

      {toast && <Toast message={toast.message} type={toast.type} duration={4000} onClose={() => setToast(null)} />}
    </>
  );
}
