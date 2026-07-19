import { useState } from "react";
import type { Abi, TransactionReceipt } from "viem";
import { useAccount, useConnect } from "wagmi";
import { waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { wagmiConfig } from "./wagmi";
import { notifyTransaction, resolveTransaction } from "./transaction-toasts";

type Status = "idle" | "connecting" | "signing" | "confirming" | "error";

interface ContractCall {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  chainId: number;
  label: string;
}

// Shared write path for one-shot contract calls that don't need a backend
// "recording" step afterward (e.g. consumeAuction settlement) - handles
// wallet connect, signing, waiting for the receipt (including a revert
// check), and surfacing a transaction-toasts popover throughout. Flows that
// need to persist something to the API once the tx lands (faucet claim,
// polymerase) follow the same connect/sign/confirm shape inline instead of
// through this hook, since they have an extra "recording" status step.
export function useContractTransaction() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const { isConnected } = useAccount();
  const { connectors, connectAsync } = useConnect();

  async function submit(call: ContractCall): Promise<boolean> {
    setStatus("connecting");
    setError(null);
    setReceipt(null);
    let toastId: string | null = null;
    try {
      if (!isConnected) {
        const connector = connectors[0];
        if (!connector) {
          throw new Error("No wallet found — install MetaMask or another browser wallet.");
        }
        await connectAsync({ connector });
      }

      setStatus("signing");
      const hash = await writeContract(wagmiConfig, {
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args ?? [],
        chainId: call.chainId as 11155111 | 31337,
      });

      toastId = notifyTransaction({ chainId: call.chainId, hash, label: call.label });

      setStatus("confirming");
      const txReceipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: call.chainId as 11155111 | 31337 });
      if (txReceipt.status !== "success") {
        throw new Error("Transaction reverted on-chain.");
      }
      resolveTransaction(toastId, "success");

      setReceipt(txReceipt);
      setStatus("idle");
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transaction failed";
      if (toastId) resolveTransaction(toastId, "error", message);
      setStatus("error");
      setError(message);
      return false;
    }
  }

  return { submit, status, error, receipt };
}
