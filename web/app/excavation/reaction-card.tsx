import type { PolymerizationRecord } from "./use-polymerization-history";

interface ReactionCardProps {
  reaction: PolymerizationRecord;
  onClick?: () => void;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function ReactionCard({ reaction, onClick }: ReactionCardProps) {
  const upgrades = Object.entries(reaction.upgradedTraits || {});
  const experience = Object.entries(reaction.experienceGained || {});
  const name = reaction.targetMetadata?.name || `Artifact #${reaction.targetTokenId?.slice(-6)}`;
  const timeAgo = getTimeAgo(new Date(reaction.createdAt));

  return (
    <div
      onClick={onClick}
      className={`rounded border border-purple-900/30 bg-purple-950/20 p-1.5 ${
        onClick ? "cursor-pointer transition-colors hover:border-purple-700/50 hover:bg-purple-950/40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[9px] font-medium text-purple-200">⚗️ {name}</div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {upgrades.map(([key, { from, to }]) => (
              <span key={key} className="rounded border border-emerald-700/30 bg-emerald-950/50 px-1 py-0.5 text-[8px] text-emerald-300">
                ⬆ {key}: {from} → {to}
              </span>
            ))}
            {experience.map(([key, xp]) => (
              <span key={key} className="rounded border border-amber-700/30 bg-amber-950/50 px-1 py-0.5 text-[8px] text-amber-300">
                +{xp} {key} XP
              </span>
            ))}
            {reaction.essenceYield > 0 && (
              <span className="rounded border border-purple-700/30 bg-purple-950/50 px-1 py-0.5 text-[8px] text-purple-300">
                +{reaction.essenceYield} ✨
              </span>
            )}
          </div>
        </div>
        <div className="whitespace-nowrap text-[8px] text-stone-500">{timeAgo}</div>
      </div>
    </div>
  );
}
