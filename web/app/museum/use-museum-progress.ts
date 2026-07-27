import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

export interface CupboardState {
  filledForms: Record<string, string | null>;
  complete: boolean;
  alreadyCompleted: boolean;
  points: number;
}

export type MuseumGrid = Record<string, Record<string, Record<string, CupboardState>>>;

async function fetchMuseumProgress(owner: string, chainId: number): Promise<MuseumGrid> {
  const data = await apiJson<{ grid: MuseumGrid }>(`/museum/progress?owner=${owner}&chainId=${chainId}`);
  return data.grid;
}

export function useMuseumProgress() {
  const { address, chainId, isConnected } = useAccount();
  return useQuery({
    queryKey: ["museum-progress", address, chainId],
    queryFn: () => fetchMuseumProgress(address!, chainId!),
    enabled: isConnected && !!address && !!chainId,
  });
}
