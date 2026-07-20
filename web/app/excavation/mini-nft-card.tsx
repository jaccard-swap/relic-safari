import type { Nft } from "../lib/use-nfts";
import { FORM_EMOJI, RARITY_EMOJI, getCardStyles, getNameStyles } from "../lib/artifact-styles";

interface MiniNftCardProps {
  nft: Nft;
  selected?: boolean;
  role?: "target" | "consumed";
  onSelect?: () => void;
  onClick?: () => void;
}

export function MiniNftCard({ nft, selected, role, onSelect, onClick }: MiniNftCardProps) {
  const metadata = nft.metadata;
  const rarity = (metadata.rarity as string) || "common";
  const form = metadata.form as string;
  const cardStyles = getCardStyles(rarity);
  const nameStyles = getNameStyles(rarity);

  const ringColor = role === "target" ? "ring-emerald-400" : role === "consumed" ? "ring-cyan-400" : "ring-amber-400";
  const handleClick = onSelect || onClick;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center gap-2 rounded border p-1.5 text-left transition-all ${cardStyles} ${
        selected ? `ring-2 ${ringColor}` : ""
      } ${handleClick ? "cursor-pointer hover:brightness-110" : ""}`}
    >
      <div className="flex h-5 w-5 items-center justify-center rounded bg-black/30 text-xs">{form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}</div>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-xs ${nameStyles}`}>
          {RARITY_EMOJI[rarity]} {metadata.name || `#${nft.tokenId.slice(-6)}`}
        </div>
      </div>
      {role === "target" && <span className="text-[11px] font-medium text-emerald-400">TARGET</span>}
      {role === "consumed" && <span className="text-[11px] font-medium text-cyan-400">FUSE</span>}
    </button>
  );
}
