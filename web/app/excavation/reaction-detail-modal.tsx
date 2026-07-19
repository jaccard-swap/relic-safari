import type { PolymerizationRecord } from "./use-polymerization-history";
import { InfoModal } from "../components/info-modal";
import { getExplorerUrlForChain } from "../lib/explorer";

interface ReactionDetailModalProps {
  reaction: PolymerizationRecord | null;
  onClose: () => void;
  chainId?: number;
}

export function ReactionDetailModal({ reaction, onClose, chainId }: ReactionDetailModalProps) {
  if (!reaction) return null;

  const txUrl = reaction.txHash && chainId ? getExplorerUrlForChain(chainId, reaction.txHash, "transaction") : null;

  const upgrades = Object.entries(reaction.upgradedTraits || {});
  const experience = Object.entries(reaction.experienceGained || {});
  const metadata = reaction.targetMetadata || {};
  const name = metadata.name || `Artifact #${reaction.targetTokenId?.slice(-6)}`;
  const date = new Date(reaction.createdAt);

  return (
    <InfoModal open={true} onClose={onClose} title="Fusion Result" icon="⚗️">
      <div className="mb-3">
        <div className="mb-1 text-[10px] text-stone-500">Target Artifact</div>
        <div className="rounded border border-purple-700/30 bg-purple-950/30 p-2">
          <div className="text-sm font-medium text-purple-200">{name}</div>
          {metadata.rarity && (
            <div className="mt-0.5 text-[10px] text-stone-400">
              {metadata.rarity as string} {(metadata.form as string) || "artifact"}
            </div>
          )}
        </div>
      </div>

      {upgrades.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] text-stone-500">Trait Upgrades</div>
          <div className="space-y-1">
            {upgrades.map(([key, { from, to }]) => (
              <div key={key} className="flex items-center justify-between rounded border border-emerald-700/30 bg-emerald-950/30 p-1.5">
                <span className="text-[10px] capitalize text-stone-400">{key}</span>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-stone-500">{from}</span>
                  <span className="text-emerald-400">→</span>
                  <span className="font-medium text-emerald-300">{to}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {experience.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] text-stone-500">Experience Gained</div>
          <div className="space-y-1">
            {experience.map(([key, xp]) => (
              <div key={key} className="flex items-center justify-between rounded border border-amber-700/30 bg-amber-950/30 p-1.5">
                <span className="text-[10px] capitalize text-stone-400">{key}</span>
                <span className="text-[10px] font-medium text-amber-300">+{xp} XP</span>
              </div>
            ))}
          </div>
          <div className="mt-1 text-[8px] text-stone-500">Experience accumulates toward the next trait level</div>
        </div>
      )}

      {reaction.essenceYield > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] text-stone-500">Essence Extracted</div>
          <div className="rounded border border-purple-700/30 bg-purple-950/30 p-2 text-center">
            <span className="text-lg text-purple-300">+{reaction.essenceYield} ✨</span>
            <div className="mt-0.5 text-[8px] text-stone-500">From non-matching traits on consumed artifact</div>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded bg-stone-800/50 p-1.5 text-center">
          <div className="text-sm text-emerald-400">{upgrades.length}</div>
          <div className="text-[8px] text-stone-500">Upgrades</div>
        </div>
        <div className="rounded bg-stone-800/50 p-1.5 text-center">
          <div className="text-sm text-amber-400">{experience.length}</div>
          <div className="text-[8px] text-stone-500">XP Gains</div>
        </div>
        <div className="rounded bg-stone-800/50 p-1.5 text-center">
          <div className="text-sm text-purple-400">{reaction.essenceYield}</div>
          <div className="text-[8px] text-stone-500">Essence</div>
        </div>
      </div>

      <div className="border-t border-stone-700 pt-2">
        <div className="space-y-1 text-[9px] text-stone-500">
          <div className="flex justify-between">
            <span>Date</span>
            <span className="text-stone-400">{date.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className={reaction.status === "success" ? "text-emerald-400" : "text-stone-400"}>{reaction.status}</span>
          </div>
          {reaction.txHash && (
            <div className="flex justify-between">
              <span>Transaction</span>
              {txUrl ? (
                <a href={txUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-400/80 hover:text-amber-300 hover:underline">
                  {reaction.txHash.slice(0, 8)}...{reaction.txHash.slice(-6)} ↗
                </a>
              ) : (
                <span className="font-mono text-stone-400">
                  {reaction.txHash.slice(0, 8)}...{reaction.txHash.slice(-6)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </InfoModal>
  );
}
