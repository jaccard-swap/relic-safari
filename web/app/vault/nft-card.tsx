import {
  AGE_STYLES,
  FORM_EMOJI,
  INSCRIPTION_EMOJI,
  INSCRIPTION_STYLES,
  MATERIAL_STYLES,
  QUALITY_BADGE,
  QUALITY_EMOJI,
  RARITY_EMOJI,
  SITE_STYLES,
  getCardStyles,
  getNameStyles,
} from "../lib/artifact-styles";
import { getChainName } from "../lib/explorer";
import type { Nft } from "../lib/use-nfts";

interface NftCardProps {
  nft: Nft;
  isExpanded: boolean;
  onToggle: () => void;
  onAuction: () => void;
  onShowDetails: () => void;
}

export function NftCard({ nft, isExpanded, onToggle, onAuction, onShowDetails }: NftCardProps) {
  const metadata = nft.metadata;
  const rarity = (metadata.rarity as string) || "common";
  const form = metadata.form as string | undefined;
  const quality = metadata.quality as string | undefined;
  const inscription = metadata.inscription as string | undefined;
  const age = metadata.age as string | undefined;
  const material = metadata.material as string | undefined;
  const site = metadata.site as string | undefined;

  const cardStyles = getCardStyles(rarity);
  const nameStyles = getNameStyles(rarity);

  function handleAuction(e: React.MouseEvent) {
    e.stopPropagation();
    onAuction();
  }

  function handleDetails(e: React.MouseEvent) {
    e.stopPropagation();
    onShowDetails();
  }

  return (
    <div className="rounded overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2 p-2 border transition-all text-left ${cardStyles} ${isExpanded ? "rounded-t border-b-0" : "rounded"}`}
      >
        <div className="w-6 h-6 flex items-center justify-center bg-black/30 rounded text-sm shrink-0">{form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}</div>

        <div className="min-w-0 flex-1">
          <div className={`text-[13px] truncate ${nameStyles}`}>
            {RARITY_EMOJI[rarity] || ""} {metadata.name || `#${nft.tokenId.slice(-6)}`}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            {age && <span title={age}>{AGE_STYLES[age]?.emoji || "📅"}</span>}
            {material && <span title={material}>{MATERIAL_STYLES[material]?.emoji || "🪨"}</span>}
            {quality && <span title={quality}>{QUALITY_EMOJI[quality] || ""}</span>}
            {inscription && inscription !== "unmarked" && <span title={inscription}>{INSCRIPTION_EMOJI[inscription] || ""}</span>}
            {site && <span title={site}>{SITE_STYLES[site]?.emoji || "📍"}</span>}
          </div>
        </div>

        <button type="button" onClick={handleDetails} className="text-xs text-white/30 hover:text-amber-300 shrink-0 px-1.5">
          ?
        </button>
        <div className="text-[10px] text-white/30 shrink-0">{getChainName(nft.chainId)}</div>
        <svg className={`w-2.5 h-2.5 text-white/30 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`grid transition-all duration-200 ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className={`p-2 border border-t-0 rounded-b ${cardStyles}`}>
            <div className="grid grid-cols-3 gap-x-1 gap-y-0.5 mb-2 text-[11px] text-white/50">
              {age && (
                <span>
                  {AGE_STYLES[age]?.emoji} <span className={AGE_STYLES[age]?.style}>{age}</span>
                </span>
              )}
              {material && (
                <span>
                  {MATERIAL_STYLES[material]?.emoji} <span className={MATERIAL_STYLES[material]?.style}>{material}</span>
                </span>
              )}
              {quality && (
                <span>
                  {QUALITY_EMOJI[quality]} <span className={QUALITY_BADGE[quality]}>{quality}</span>
                </span>
              )}
              {inscription && (
                <span>
                  {INSCRIPTION_EMOJI[inscription]} <span className={INSCRIPTION_STYLES[inscription]}>{inscription}</span>
                </span>
              )}
              {site && (
                <span>
                  {SITE_STYLES[site]?.emoji} <span className={SITE_STYLES[site]?.style}>{site.replace("-", " ")}</span>
                </span>
              )}
              <span>
                {RARITY_EMOJI[rarity]} <span className={nameStyles}>{rarity}</span>
              </span>
            </div>

            <div className="flex gap-1.5">
              <button type="button" onClick={handleAuction} className="flex-1 py-1.5 bg-amber-700/80 hover:bg-amber-600 text-white text-xs font-medium rounded transition-colors">
                🏛️ Auction
              </button>
              <button type="button" disabled className="flex-1 py-1.5 bg-stone-600/30 text-stone-500 text-xs font-medium rounded cursor-not-allowed">
                ⚗️ Fuse
              </button>
              <button type="button" disabled className="flex-1 py-1.5 bg-stone-700/30 text-stone-500 text-xs font-medium rounded cursor-not-allowed">
                ↗ Gift
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
