import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { useBalances } from "../lib/use-balances";
import { useFaucetHistory } from "./use-faucet-history";
import { useErc20Faucet } from "./use-erc20-faucet";
import { useFaucetEligibility, formatCooldown } from "./use-faucet-eligibility";
import { ClaimModal } from "./claim-modal";
import { CollapsibleSection } from "../components/collapsible-section";
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
  const [modalOpen, setModalOpen] = useState(false);

  const { chainId } = useAccount();
  const { scripBalance, isConnected, refetchScrip } = useBalances();
  const { data: history = [] } = useFaucetHistory();
  const { eligible, msRemaining, refetchLastClaim } = useFaucetEligibility();

  const { claimFaucetErc20, hash: claimHash, mintedAmount, isPending: claimPending, isConfirming: claimConfirming, isConfirmed: claimConfirmed, error: claimError } =
    useErc20Faucet();

  const handleClaim = useCallback(() => {
    if (!eligible) return;
    setModalOpen(true);
    claimFaucetErc20();
  }, [claimFaucetErc20, eligible]);

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
            disabled={!isConnected || claimPending || claimConfirming || !eligible}
            title={!eligible ? `Available in ${formatCooldown(msRemaining)}` : undefined}
            className="relative w-14 rounded bg-gradient-to-r from-amber-600 to-yellow-700 py-2 text-center text-xs font-medium text-white transition-all hover:from-amber-500 hover:to-yellow-600 disabled:opacity-50"
          >
            {claimPending || claimConfirming ? "⏳" : !eligible ? "🔒" : "Claim"}
          </button>
        }
      >
        <div className="mt-3 space-y-1 rounded border border-stone-700/50 bg-stone-800/50 px-2 py-2 text-xs text-stone-500">
          <div>
            <span className="text-amber-400">Each claim:</span> ~5.236 SCRIP (2φ²)
          </div>
          <div className={eligible ? "text-stone-600" : "text-amber-500"}>
            {chainId === 31337
              ? "Unlimited - claim as often as you like"
              : eligible
                ? "12 hour cooldown per address"
                : `Next claim available in ${formatCooldown(msRemaining)}`}
          </div>
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

      <ClaimModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        chainId={chainId}
        hash={claimHash}
        mintedAmount={mintedAmount}
        isPending={claimPending}
        isConfirming={claimConfirming}
        isConfirmed={claimConfirmed}
        error={claimError}
        refetchScrip={refetchScrip}
        refetchLastClaim={refetchLastClaim}
      />
    </>
  );
}
