import { useState } from "react";
import { ApiError } from "../lib/api";
import { useScanStandingBids } from "../lib/use-scan-standing-bids";
import { Toast } from "../components/toast";

interface StandingBidScanProps {
  auctionId: string;
}

// Auctioneer-only manual re-trigger of the same match/attach check that
// already fires silently for every room visitor (use-check-standing-bids.ts)
// - this one just reports what happened instead of discarding the result.
export function StandingBidScan({ auctionId }: StandingBidScanProps) {
  const scan = useScanStandingBids(auctionId);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  function handleScan() {
    setToast(null);
    scan.mutate(undefined, {
      onSuccess: (outcome) => {
        if (outcome.kind === "matched") {
          const count = outcome.bids.length;
          setToast({ message: `${count} standing buy order${count === 1 ? "" : "s"} matched!`, type: "success" });
        } else if (outcome.kind === "empty") {
          setToast({ message: "No standing buy orders matched right now", type: "info" });
        } else {
          setToast({ message: outcome.message, type: "info" });
        }
      },
      onError: (err) => {
        setToast({ message: err instanceof ApiError ? err.message : "Failed to scan for standing buy orders", type: "error" });
      },
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleScan}
        disabled={scan.isPending}
        className="w-full rounded border border-stone-700 bg-stone-800/50 py-2 text-xs font-medium text-stone-300 transition-opacity hover:bg-stone-800 disabled:opacity-50"
      >
        {scan.isPending ? "Scanning…" : "🔍 Scan for standing buy orders"}
      </button>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
