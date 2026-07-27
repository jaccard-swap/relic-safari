import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";

export interface LeaderboardEntry {
  rank: number;
  owner: string;
  points: number;
  badgeCount: number;
}

async function fetchLeaderboard(chainId: number): Promise<LeaderboardEntry[]> {
  const data = await apiJson<{ leaderboard: LeaderboardEntry[] }>(`/museum/leaderboard?chainId=${chainId}`);
  return data.leaderboard;
}

// Built from the API's own cupboard_completions record, not an on-chain
// scan - every completion is a sponsored tx the API itself submits, so it's
// already the complete record (see api/src/routes/museum/index.ts's
// GET /leaderboard for the full reasoning).
export function useLeaderboard() {
  const { chainId } = useAccount();
  return useQuery({
    queryKey: ["leaderboard", chainId],
    queryFn: () => fetchLeaderboard(chainId!),
    enabled: !!chainId,
  });
}
