import { erc20Abi, formatEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { getContract } from "./contracts";

export interface TokenBalance {
  value: bigint;
  formatted: number;
  count: number;
}

function toBalance(raw: bigint | undefined): TokenBalance | null {
  if (raw === undefined) return null;
  const formatted = parseFloat(formatEther(raw));
  return { value: raw, formatted, count: Math.floor(formatted) };
}

// Reads SCRIP + Essence balances directly via wagmi (not the API) - these
// are on-chain ERC20 balances, so there's no backend round-trip to make.
export function useBalances() {
  const { address, isConnected, chainId } = useAccount();
  const scrip = chainId ? getContract(chainId, "Scrip") : null;
  const essence = chainId ? getContract(chainId, "Essence") : null;

  const { data: scripRaw, refetch: refetchScrip } = useReadContract({
    address: scrip?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!scrip },
  });

  const { data: essenceRaw, refetch: refetchEssence } = useReadContract({
    address: essence?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!essence },
  });

  return {
    scripBalance: toBalance(scripRaw),
    essenceBalance: toBalance(essenceRaw),
    refetchScrip,
    refetchEssence,
    refetchBalances: () => {
      void refetchScrip();
      void refetchEssence();
    },
    isConnected,
    chainId,
  };
}
