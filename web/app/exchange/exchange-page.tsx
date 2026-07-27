import { useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useBalances } from "../lib/use-balances";
import { getContract } from "../lib/contracts";
import { useSwapQuote } from "./use-swap-quote";
import { useSwap } from "./use-swap";

type Direction = "scrip-to-essence" | "essence-to-scrip";

export function ExchangePage() {
  const { chainId } = useAccount();
  const { scripBalance, essenceBalance, refetchBalances } = useBalances();
  const [direction, setDirection] = useState<Direction>("scrip-to-essence");
  const [amountText, setAmountText] = useState("");

  const scrip = chainId ? getContract(chainId, "Scrip") : null;
  const essence = chainId ? getContract(chainId, "Essence") : null;

  const fromToken = direction === "scrip-to-essence" ? scrip : essence;
  const toToken = direction === "scrip-to-essence" ? essence : scrip;
  const fromLabel = direction === "scrip-to-essence" ? "SCRIP" : "Essence";
  const toLabel = direction === "scrip-to-essence" ? "Essence" : "SCRIP";
  const fromBalance = direction === "scrip-to-essence" ? scripBalance : essenceBalance;

  let amountIn: bigint | null = null;
  try {
    amountIn = amountText ? parseEther(amountText) : null;
  } catch {
    amountIn = null;
  }

  const { amountOut, isLoading: quoteLoading } = useSwapQuote(fromToken?.address, toToken?.address, amountIn);
  const swap = useSwap(fromToken?.address);

  useEffect(() => {
    if (swap.approveConfirmed) {
      swap.refetchAllowance();
    }
  }, [swap.approveConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (swap.swapConfirmed) {
      setAmountText("");
      swap.refetchAllowance();
      void refetchBalances();
    }
  }, [swap.swapConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const flip = () => {
    setDirection((d) => (d === "scrip-to-essence" ? "essence-to-scrip" : "scrip-to-essence"));
    setAmountText("");
    swap.resetSwap();
  };

  const canAct = !!amountIn && amountIn > 0n && !!fromBalance && amountIn <= fromBalance.value;
  const needsApproval = amountIn ? swap.needsApproval(amountIn) : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-amber-900/30 bg-stone-800/50 p-3">
        <span className="text-xs font-semibold text-amber-300">⚖️ Exchange</span>
        <div className="flex items-baseline gap-3 text-xs">
          <span>
            <span className="font-mono text-amber-200">{scripBalance?.count ?? 0}</span> <span className="text-stone-500">💰 SCRIP</span>
          </span>
          <span>
            <span className="font-mono text-purple-300">{essenceBalance?.count ?? 0}</span> <span className="text-stone-500">✨ Essence</span>
          </span>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-stone-400">
        Swap SCRIP and Essence directly against a real, live Uniswap V2 pool - the market decides the rate.
      </p>

      <div className="rounded-lg border border-amber-900/30 bg-stone-800/50 p-3">
        <div className="rounded border border-stone-700/50 bg-stone-900/40 p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
            <span>From</span>
            <span>
              Balance: {fromBalance?.formatted?.toFixed(4) ?? "0"} {fromLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="w-full bg-transparent text-lg text-stone-200 outline-none placeholder:text-stone-600"
            />
            <span className={`text-sm font-medium ${direction === "scrip-to-essence" ? "text-amber-300" : "text-purple-300"}`}>{fromLabel}</span>
          </div>
        </div>

        <div className="flex justify-center py-1">
          <button
            type="button"
            onClick={flip}
            className="rounded-full border border-amber-900/40 bg-stone-800 p-1.5 text-amber-300 transition-colors hover:bg-stone-700"
            title="Flip direction"
          >
            ⇅
          </button>
        </div>

        <div className="rounded border border-stone-700/50 bg-stone-900/40 p-3">
          <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
            <span>To (estimated)</span>
            <span>
              Balance: {(direction === "scrip-to-essence" ? essenceBalance : scripBalance)?.formatted?.toFixed(4) ?? "0"} {toLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-full text-lg text-stone-300">
              {quoteLoading ? "…" : amountOut !== undefined ? parseFloat(formatEther(amountOut)).toFixed(6) : "0.0"}
            </span>
            <span className={`text-sm font-medium ${direction === "scrip-to-essence" ? "text-purple-300" : "text-amber-300"}`}>{toLabel}</span>
          </div>
        </div>

        {needsApproval ? (
          <button
            type="button"
            onClick={() => amountIn && swap.approve(amountIn)}
            disabled={!canAct || swap.isApproving}
            className="mt-3 w-full rounded bg-gradient-to-r from-amber-600 to-yellow-700 py-2 text-sm font-medium text-white transition-all hover:from-amber-500 hover:to-yellow-600 disabled:cursor-not-allowed disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-400"
          >
            {swap.isApproving ? "Approving…" : `Approve ${fromLabel}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => amountIn && amountOut !== undefined && toToken && swap.swap(toToken.address, amountIn, amountOut)}
            disabled={!canAct || !amountOut || swap.isSwapping}
            className="mt-3 w-full rounded bg-gradient-to-r from-purple-600 to-violet-700 py-2 text-sm font-medium text-white transition-all hover:from-purple-500 hover:to-violet-600 disabled:cursor-not-allowed disabled:from-stone-700 disabled:to-stone-700 disabled:text-stone-400"
          >
            {swap.isSwapping ? "Swapping…" : "Swap"}
          </button>
        )}

        {swap.swapConfirmed && <p className="mt-2 text-center text-xs text-emerald-400">Swap complete!</p>}
        {swap.swapReverted && <p className="mt-2 text-center text-xs text-red-400">Swap reverted on-chain.</p>}
        {(swap.approveError || swap.swapError) && (
          <p className="mt-2 text-center text-xs text-red-400">{(swap.approveError ?? swap.swapError)?.message}</p>
        )}
      </div>
    </div>
  );
}
