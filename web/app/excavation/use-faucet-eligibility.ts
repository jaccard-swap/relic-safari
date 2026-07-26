import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { getContract } from "../lib/contracts";

// Mirrors Scrip.sol's own block.chainid check in faucet() - the cooldown is
// skipped entirely on local hardhat, so there's nothing to read or wait on.
const HARDHAT_CHAIN_ID = 31337;

export function formatCooldown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Reads lastFaucetClaim()+FAUCET_COOLDOWN() straight off Scrip rather than
// calling faucet() to find out it'll revert - cheaper than a callStatic
// (one read vs. simulating the full write), and it lets the UI show a
// countdown instead of just disabling the button with no explanation.
export function useFaucetEligibility() {
  const { address, chainId } = useAccount();
  const scrip = chainId ? getContract(chainId, "Scrip") : null;
  const skipsCooldown = chainId === HARDHAT_CHAIN_ID;
  const [now, setNow] = useState(() => Date.now());

  const { data: lastClaim, refetch: refetchLastClaim } = useReadContract({
    address: scrip?.address,
    abi: scrip?.abi,
    functionName: "lastFaucetClaim",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!scrip && !skipsCooldown },
  });

  const { data: cooldown } = useReadContract({
    address: scrip?.address,
    abi: scrip?.abi,
    functionName: "FAUCET_COOLDOWN",
    query: { enabled: !!scrip && !skipsCooldown },
  });

  const availableAt = skipsCooldown || lastClaim === undefined || cooldown === undefined ? 0 : (Number(lastClaim) + Number(cooldown)) * 1000;

  const msRemaining = Math.max(0, availableAt - now);
  const eligible = msRemaining <= 0;

  useEffect(() => {
    if (eligible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [eligible]);

  return { eligible, msRemaining, refetchLastClaim };
}
