import type { Nft } from "../lib/use-nfts";
import {
  AGE_STYLES,
  FORM_EMOJI,
  INSCRIPTION_EMOJI,
  MATERIAL_STYLES,
  QUALITY_EMOJI,
  RARITY_EMOJI,
  SITE_STYLES,
  getCardStyles,
  getNameStyles,
} from "../lib/artifact-styles";

interface TradingCardProps {
  nft: Nft;
  selected?: boolean;
  role?: "target" | "consumed";
  onSelect?: () => void;
  onClick?: () => void;
}

// Larger, wrap-friendly sibling of MiniNftCard - same selection semantics,
// laid out like a trading card so a row of artifacts is easier to visually
// compare side by side than the compact list rows.
export function TradingCard({ nft, selected, role, onSelect, onClick }: TradingCardProps) {
  const metadata = nft.metadata;
  const rarity = (metadata.rarity as string) || "common";
  const form = metadata.form as string;
  const quality = metadata.quality as string;
  const inscription = metadata.inscription as string;
  const age = metadata.age as string;
  const material = metadata.material as string;
  const site = metadata.site as string;
  const cardStyles = getCardStyles(rarity);
  const nameStyles = getNameStyles(rarity);

  const ringColor = role === "target" ? "ring-emerald-400" : role === "consumed" ? "ring-cyan-400" : "ring-amber-400";
  const handleClick = onSelect || onClick;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-32 shrink-0 flex-col gap-1.5 rounded-lg border p-2 text-left transition-all ${cardStyles} ${
        selected ? `ring-2 ${ringColor}` : ""
      } ${handleClick ? "cursor-pointer hover:brightness-110" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs">{RARITY_EMOJI[rarity]}</span>
        {role === "target" && <span className="text-[9px] font-medium text-emerald-400">TARGET</span>}
        {role === "consumed" && <span className="text-[9px] font-medium text-cyan-400">FUSE</span>}
      </div>
      <div className="flex h-14 items-center justify-center rounded bg-black/30 text-3xl">{form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}</div>
      <div className={`truncate text-xs ${nameStyles}`}>{metadata.name || `#${nft.tokenId.slice(-6)}`}</div>
      <div className="flex flex-wrap gap-1 text-xs">
        {age && <span title={age}>{AGE_STYLES[age]?.emoji}</span>}
        {material && <span title={material}>{MATERIAL_STYLES[material]?.emoji}</span>}
        {quality && <span title={quality}>{QUALITY_EMOJI[quality]}</span>}
        {inscription && inscription !== "unmarked" && <span title={inscription}>{INSCRIPTION_EMOJI[inscription]}</span>}
        {site && <span title={site}>{SITE_STYLES[site]?.emoji}</span>}
      </div>
    </button>
  );
}
