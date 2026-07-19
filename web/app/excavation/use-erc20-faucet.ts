import { useCallback, useEffect, useRef, useState } from "react";
import { zeroAddress } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWatchContractEvent, useWriteContract } from "wagmi";
import { getContract } from "../lib/contracts";
import { notifyTransaction, resolveTransaction } from "../lib/transaction-toasts";

// Claiming SCRIP doesn't return the minted amount directly - it's read off
// the mint's Transfer event (from the zero address) once it lands.
export function useErc20Faucet() {
  const { address, chainId } = useAccount();
  const scrip = chainId ? getContract(chainId, "Scrip") : null;
  const [mintedAmount, setMintedAmount] = useState<string | null>(null);
  const [awaitingMint, setAwaitingMint] = useState(false);
  const toastIdRef = useRef<string | null>(null);

  const { data: hash, isPending, writeContract, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = useWaitForTransactionReceipt({ hash });

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
    if (hash && chainId && !toastIdRef.current) {
      toastIdRef.current = notifyTransaction({ chainId, hash, label: "Claiming SCRIP" });
    }
  }, [hash, chainId]);

  useEffect(() => {
    // Fallback in case the Transfer event watcher missed it.
    if (isConfirmed) {
      setAwaitingMint(false);
      if (toastIdRef.current) resolveTransaction(toastIdRef.current, "success");
    }
  }, [isConfirmed]);

  const error = writeError || receiptError;
  useEffect(() => {
    if (error && toastIdRef.current) {
      resolveTransaction(toastIdRef.current, "error", error.message);
    }
  }, [error]);

  const claimFaucetErc20 = useCallback(() => {
    if (!address || !scrip) return;
    reset();
    setMintedAmount(null);
    setAwaitingMint(true);
    toastIdRef.current = null;
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
