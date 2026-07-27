import { useAccount, useReadContract } from "wagmi";
import { getContract } from "./contracts";

// Badges has no balanceOf(address) - that selector is already Essence's
// ERC20 balanceOf on this same diamond, so BadgesFacet exposes badgeCount
// instead (see BadgesFacet.sol's header comment for why).
export function useBadgeCount() {
  const { address, isConnected, chainId } = useAccount();
  const badges = chainId ? getContract(chainId, "Badges") : null;

  const { data, refetch } = useReadContract({
    address: badges?.address,
    abi: badges?.abi,
    functionName: "badgeCount",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && !!address && !!badges },
  });

  return {
    badgeCount: data !== undefined ? Number(data) : null,
    refetchBadgeCount: refetch,
  };
}
