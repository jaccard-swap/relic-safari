import { useCallback } from "react";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { getContract } from "../lib/contracts";

// 2% fixed slippage tolerance - simple and safe enough for this feature's
// scope (a game-economy sink, not a trading terminal); a 0 amountOutMin
// would let the swap execute at any price, including a sandwiched one.
const SLIPPAGE_BPS = 200n;
const BPS_DENOMINATOR = 10000n;

export function useSwap(tokenIn: `0x${string}` | undefined) {
  const { address, chainId } = useAccount();
  const router = chainId ? getContract(chainId, "UniswapV2Router02") : null;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenIn,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && router ? [address, router.address] : undefined,
    query: { enabled: !!address && !!router && !!tokenIn },
  });

  const approveWrite = useWriteContract();
  const { data: approveReceipt, isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveWrite.data });
  const approveConfirmed = approveReceipt?.status === "success";

  const swapWrite = useWriteContract();
  const { data: swapReceipt, isLoading: isSwapping } = useWaitForTransactionReceipt({ hash: swapWrite.data });
  const swapConfirmed = swapReceipt?.status === "success";
  const swapReverted = swapReceipt?.status === "reverted";

  const needsApproval = useCallback(
    (amountIn: bigint) => allowance === undefined || allowance < amountIn,
    [allowance],
  );

  const approve = useCallback(
    (amountIn: bigint) => {
      if (!tokenIn || !router) return;
      approveWrite.writeContract({
        address: tokenIn,
        abi: erc20Abi,
        functionName: "approve",
        args: [router.address, amountIn],
      });
    },
    [tokenIn, router, approveWrite],
  );

  const swap = useCallback(
    (tokenOut: `0x${string}`, amountIn: bigint, amountOutQuoted: bigint) => {
      if (!address || !router) return;
      const amountOutMin = (amountOutQuoted * (BPS_DENOMINATOR - SLIPPAGE_BPS)) / BPS_DENOMINATOR;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
      swapWrite.writeContract({
        address: router.address,
        abi: router.abi,
        functionName: "swapExactTokensForTokens",
        args: [amountIn, amountOutMin, [tokenIn, tokenOut], address, deadline],
      });
    },
    [address, router, tokenIn, swapWrite],
  );

  return {
    needsApproval,
    approve,
    isApproving: approveWrite.isPending || isApproving,
    approveConfirmed,
    approveError: approveWrite.error,
    refetchAllowance,
    swap,
    isSwapping: swapWrite.isPending || isSwapping,
    swapConfirmed,
    swapReverted,
    swapError: swapWrite.error,
    resetSwap: swapWrite.reset,
  };
}
