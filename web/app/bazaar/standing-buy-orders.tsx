import { useMemo, useState } from "react";
import { computeMinHash, MINHASH_BANDS } from "@shared/constants";
import { useAccount } from "wagmi";
import { CollapsibleSection } from "../components/collapsible-section";
import { Toast } from "../components/toast";
import { useCancelStandingBid, useCreateStandingBid, useStandingBids } from "../lib/standing-bids";
import { useAuthGate } from "../auth/use-auth-gate";
import { MinHashPreview } from "./minhash-preview";
import { StandingBidCard } from "./standing-bid-card";
import { TraitChip, TraitSelector } from "./trait-selector";

interface StandingBuyOrdersProps {
  expanded: boolean;
  onToggle: () => void;
  onHelp: () => void;
}

const DEFAULT_MIN_MATCHES = 8; // matches the Polymerase "8/20 band matches" convention

export function StandingBuyOrders({ expanded, onToggle, onHelp }: StandingBuyOrdersProps) {
  const { isConnected } = useAccount();
  const authenticated = useAuthGate();
  const { data: standingBids, isLoading } = useStandingBids();
  const createBid = useCreateStandingBid();
  const cancelBid = useCancelStandingBid();

  const [traits, setTraits] = useState<Record<string, string>>({});
  const [minMatches, setMinMatches] = useState(DEFAULT_MIN_MATCHES);
  const [amount, setAmount] = useState("1");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const minHash = useMemo(() => computeMinHash(traits), [traits]);
  const amountValid = /^\d*\.?\d+$/.test(amount) && parseFloat(amount) > 0;
  const canSubmit = isConnected && Object.keys(traits).length > 0 && amountValid && !createBid.isPending;

  async function handleSubmit() {
    if (!authenticated) {
      setToast({ message: "Sign in to place a standing buy order", type: "error" });
      return;
    }
    try {
      await createBid.mutateAsync({ amount, desiredTraits: traits, minMatches });
      setToast({ message: "Standing buy order placed", type: "success" });
      setTraits({});
      setAmount("1");
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to place order", type: "error" });
    }
  }

  async function handleCancel(id: string) {
    if (!authenticated) {
      setToast({ message: "Sign in to cancel a standing buy order", type: "error" });
      return;
    }
    setCancellingId(id);
    try {
      await cancelBid.mutateAsync(id);
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to cancel order", type: "error" });
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <CollapsibleSection
      title="Standing Buy Orders"
      icon="📋"
      expanded={expanded}
      onToggle={onToggle}
      onHelp={onHelp}
      summary={<span className="text-xs text-stone-500">{standingBids?.length ?? 0} active</span>}
    >
      <div className="space-y-3 pt-1">
        {!isConnected ? (
          <div className="py-3 text-center text-[13px] text-stone-400">Connect a wallet to place a standing buy order</div>
        ) : (
          <div className="space-y-3 rounded border border-stone-700/50 bg-stone-900/40 p-3">
            <TraitSelector selected={traits} onChange={setTraits} />

            {Object.keys(traits).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(traits).map(([key, value]) => (
                  <TraitChip
                    key={key}
                    traitKey={key}
                    value={value}
                    onRemove={() =>
                      setTraits((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            )}

            <MinHashPreview minHash={minHash} />

            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs text-stone-400">
                <span>Match threshold</span>
                <span className="text-amber-300">
                  {minMatches}/{MINHASH_BANDS} bands
                </span>
              </label>
              <input
                type="range"
                min={2}
                max={MINHASH_BANDS}
                value={minMatches}
                onChange={(e) => setMinMatches(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs text-stone-400">Bid (SCRIP)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-200 focus:border-amber-600 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={authenticated ? !canSubmit : Object.keys(traits).length === 0 || !amountValid}
                title={!authenticated ? "Sign in to place a standing buy order" : undefined}
                className={`rounded px-4 py-2 text-[13px] font-semibold transition-opacity disabled:opacity-50 ${
                  authenticated ? "bg-gradient-to-r from-amber-600 to-yellow-700 text-white" : "bg-stone-800 text-stone-500 hover:opacity-80"
                }`}
              >
                {createBid.isPending ? "Signing…" : authenticated ? "Place Order" : "🔒 Sign in to place order"}
              </button>
            </div>
          </div>
        )}

        {isLoading && <div className="py-3 text-center text-[13px] text-stone-400">Loading…</div>}
        {!isLoading && (!standingBids || standingBids.length === 0) && (
          <div className="py-3 text-center text-[13px] text-stone-400">No standing buy orders yet</div>
        )}
        {standingBids && standingBids.length > 0 && (
          <div className="scrollbar-thin scrollbar-thumb-stone-700 max-h-40 space-y-1.5 overflow-y-auto">
            {standingBids.map((bid) => (
              <StandingBidCard key={bid.id} bid={bid} onCancel={() => handleCancel(bid.id)} isCancelling={cancellingId === bid.id} authenticated={authenticated} />
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </CollapsibleSection>
  );
}
