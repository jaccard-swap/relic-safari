import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

interface UpgradeParams {
  tokenId: string;
  traitKey: string;
}

export interface UpgradeResult {
  success: boolean;
  requestId: string;
  txHash: string;
  chainId: number;
  tokenId: string;
  traitKey: string;
  fromValue: string;
  toValue: string;
  essenceCost: number;
}

// Resolves as soon as the upgrade tx is submitted (hash in hand), not once
// it's confirmed - the caller tracks requestId via useUpgradeRoom to find out
// when it actually lands (see api/src/routes/forge/index.ts POST /upgrade).
export function useUpgradeTrait() {
  const { address, chainId } = useAccount();

  return useMutation({
    mutationFn: async ({ tokenId, traitKey }: UpgradeParams) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson<UpgradeResult>("/forge/upgrade", {
        method: "POST",
        body: JSON.stringify({ owner: address, tokenId, traitKey, chainId }),
      });
    },
  });
}
