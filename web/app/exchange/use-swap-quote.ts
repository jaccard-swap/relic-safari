import { useAccount, useReadContract } from "wagmi";
import { getContract } from "../lib/contracts";

// Live view-only quote via the real Router's getAmountsOut - no backend
// involved, this reads straight off the pool's current reserves.
export function useSwapQuote(tokenIn: `0x${string}` | undefined, tokenOut: `0x${string}` | undefined, amountIn: bigint | null) {
  const { chainId } = useAccount();
  const router = chainId ? getContract(chainId, "UniswapV2Router02") : null;

  const { data, isLoading, error } = useReadContract({
    address: router?.address,
    abi: router?.abi,
    functionName: "getAmountsOut",
    args: amountIn && tokenIn && tokenOut ? [amountIn, [tokenIn, tokenOut]] : undefined,
    query: { enabled: !!router && !!tokenIn && !!tokenOut && !!amountIn && amountIn > 0n },
  });

  const amountOut = Array.isArray(data) ? (data[1] as bigint) : undefined;
  return { amountOut, isLoading, error };
}
