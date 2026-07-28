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

// Reads SCRIP + Essence balances, and the Museum leaderboard points total,
// directly via wagmi (not the API) - these are all on-chain reads, so
// there's no backend round-trip to make. leaderboardPoints lives on
// JaccardERC1155Facet (see CollectionFacet.completeCupboard, which awards
// it) - it's a plain point count, not an 18-decimal token amount, so it
// skips toBalance/formatEther.
export function useBalances() {
  const { address, isConnected, chainId } = useAccount();
  const scrip = chainId ? getContract(chainId, "Scrip") : null;
  const essence = chainId ? getContract(chainId, "Essence") : null;
  const jaccardErc1155 = chainId ? getContract(chainId, "JaccardERC1155") : null;

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

  const { data: leaderboardPointsRaw, refetch: refetchLeaderboardPoints } = useReadContract({
    address: jaccardErc1155?.address,
    abi: jaccardErc1155?.abi,
    functionName: "leaderboardPoints",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!jaccardErc1155 },
  });

  return {
    scripBalance: toBalance(scripRaw),
    essenceBalance: toBalance(essenceRaw),
    leaderboardPoints: leaderboardPointsRaw !== undefined ? Number(leaderboardPointsRaw) : null,
    refetchScrip,
    refetchEssence,
    refetchLeaderboardPoints,
    refetchBalances: () => {
      void refetchScrip();
      void refetchEssence();
      void refetchLeaderboardPoints();
    },
    isConnected,
    chainId,
  };
}
