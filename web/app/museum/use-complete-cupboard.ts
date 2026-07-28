import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

interface CompleteCupboardParams {
  site: string;
  age: string;
  material: string;
}

export interface CompleteCupboardResult {
  success: boolean;
  requestId: string;
  txHash: string;
  chainId: number;
  site: string;
  age: string;
  material: string;
  points: number;
}

// Resolves as soon as the completion tx is submitted (hash in hand), not
// once it's confirmed - the caller tracks requestId via useMuseumRoom to
// find out when it actually lands (see api/src/routes/museum/index.ts
// POST /complete-cupboard).
export function useCompleteCupboard() {
  const { address, chainId } = useAccount();

  return useMutation({
    mutationFn: async ({ site, age, material }: CompleteCupboardParams) => {
      if (!address || !chainId) throw new Error("Wallet not connected");
      return apiJson<CompleteCupboardResult>("/museum/complete-cupboard", {
        method: "POST",
        body: JSON.stringify({ owner: address, chainId, site, age, material }),
      });
    },
  });
}
