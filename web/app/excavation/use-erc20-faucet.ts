import { useCallback, useEffect, useState } from "react";
import { zeroAddress } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWatchContractEvent, useWriteContract } from "wagmi";
import { getContract } from "../lib/contracts";

// Scrip.sol's faucet() always mints this exact amount (2φ² SCRIP, flat, no
// tiers) - used as a fallback below if the Transfer event watcher misses it.
const FAUCET_AMOUNT_WEI = "5236067977499789696";

// Claiming SCRIP doesn't return the minted amount directly - it's read off
// the mint's Transfer event (from the zero address) once it lands.
export function useErc20Faucet() {
  const { address, chainId } = useAccount();
  const scrip = chainId ? getContract(chainId, "Scrip") : null;
  const [mintedAmount, setMintedAmount] = useState<string | null>(null);
  const [awaitingMint, setAwaitingMint] = useState(false);

  const { data: hash, isPending, writeContract, error: writeError, reset } = useWriteContract();
  // useWaitForTransactionReceipt's isSuccess only means "a receipt arrived",
  // not "the tx succeeded" - viem doesn't throw on a reverted receipt, so a
  // cooldown revert would otherwise leave the modal spinning forever
  // (isConfirmed true, but mintedAmount never arrives since no Transfer
  // event fired). Read status off the receipt itself instead.
  const { data: receipt, isLoading: isConfirming, error: receiptError } = useWaitForTransactionReceipt({ hash });
  const isConfirmed = receipt?.status === "success";
  const isReverted = receipt?.status === "reverted";

  useWatchContractEvent({
    address: scrip?.address,
    abi: scrip?.abi,
    eventName: "Transfer",
    args: { from: zeroAddress, to: address },
    enabled: awaitingMint && !!scrip && !!address,
    onLogs(logs) {
      const value = (logs[0] as { args?: { value?: bigint } } | undefined)?.args?.value;
      if (value !== undefined) {
        setMintedAmount(value.toString());
        setAwaitingMint(false);
      }
    },
  });

  useEffect(() => {
    // Fallback in case the Transfer event watcher missed it - the mint
    // amount is a fixed on-chain constant, so there's no reason to leave
    // mintedAmount null (and callers gated on it, like the balance refetch)
    // stuck waiting on an event that may never arrive.
    if (isConfirmed) {
      setAwaitingMint(false);
      setMintedAmount((prev) => prev ?? FAUCET_AMOUNT_WEI);
    } else if (isReverted) {
      // No Transfer event is ever coming for a reverted tx - stop watching.
      setAwaitingMint(false);
    }
  }, [isConfirmed, isReverted]);

  const error = writeError || receiptError || (isReverted ? new Error("Transaction reverted on-chain — you're likely still on the faucet cooldown.") : null);

  const claimFaucetErc20 = useCallback(() => {
    if (!address || !scrip) return;
    reset();
    setMintedAmount(null);
    setAwaitingMint(true);
    writeContract({
      address: scrip.address,
      abi: scrip.abi,
      functionName: "faucet",
      args: [],
    });
  }, [writeContract, address, scrip, reset]);

  return {
    claimFaucetErc20,
    hash,
    mintedAmount,
    isPending,
    isConfirming,
    isConfirmed,
    isConnected: !!address,
    error,
  };
}
