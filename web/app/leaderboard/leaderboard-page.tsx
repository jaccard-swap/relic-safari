import { useAccount } from "wagmi";
import { useLeaderboard } from "./use-leaderboard";

const shorten = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const { data: leaderboard, isLoading } = useLeaderboard();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-amber-900/30 bg-stone-800/50 p-3">
        <span className="text-xs font-semibold text-amber-300">🏆 Leaderboard</span>
        <span className="text-xs text-stone-500">Ranked by Museum points</span>
      </div>

      <p className="text-[13px] leading-relaxed text-stone-400">
        Every completed cupboard in the Museum awards points, scaled by how rare its Site+Age+Material combination is.
      </p>

      {isLoading ? (
        <div className="animate-pulse py-6 text-center text-xs text-stone-500">Loading rankings...</div>
      ) : !leaderboard || leaderboard.length === 0 ? (
        <div className="rounded border border-stone-700/50 bg-stone-800/30 p-3 text-center">
          <div className="text-[13px] text-stone-400">No completed cupboards yet</div>
          <div className="mt-1 text-xs text-stone-500">Visit the Museum to freeze your first collection</div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-teal-900/30 bg-stone-800/50">
          {leaderboard.map((entry) => {
            const isYou = isConnected && address?.toLowerCase() === entry.owner.toLowerCase();
            return (
              <div
                key={entry.owner}
                className={`flex items-center justify-between border-b border-stone-700/40 p-3 last:border-b-0 ${
                  isYou ? "bg-teal-950/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-sm">{RANK_MEDAL[entry.rank] ?? `#${entry.rank}`}</span>
                  <div>
                    <div className="font-mono text-[13px] text-stone-200">
                      {shorten(entry.owner)}
                      {isYou && <span className="ml-1.5 text-[10px] font-medium text-teal-400">YOU</span>}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {entry.badgeCount} badge{entry.badgeCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-sm text-teal-300">{entry.points} 🏅</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
