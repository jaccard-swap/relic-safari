import { useQuery } from "@tanstack/react-query";
import { apiJson } from "../lib/api";

export interface BandMatch {
  index: number;
  aHash: string;
  bHash: string;
  matches: boolean;
}

export interface TraitBreakdown {
  target: string | null;
  consumed: string | null;
  matches: boolean;
  upgradeable: boolean;
  action: "upgrade" | "essence" | "keep" | "none";
}

export interface SimulationResult {
  eligible: boolean;
  minHash: {
    bands: BandMatch[];
    matchCount: number;
    threshold: number;
    estimatedJaccard: number;
  };
  traitBreakdown: Record<string, TraitBreakdown>;
  result: {
    newMetadata: Record<string, unknown> & { name?: string };
    upgradedTraits: Record<string, { from: string; to: string }>;
    essenceYield: number;
  };
}

export function usePolymeraseSimulation(targetNftId: string | null, consumedNftId: string | null) {
  return useQuery({
    queryKey: ["polymerase-simulation", targetNftId, consumedNftId],
    queryFn: () => apiJson<SimulationResult>(`/faucet/polymerase/simulate?targetNftId=${targetNftId}&consumedNftId=${consumedNftId}`),
    enabled: !!targetNftId && !!consumedNftId,
  });
}
