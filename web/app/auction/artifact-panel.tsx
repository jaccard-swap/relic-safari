import type { Nft } from "../lib/use-nfts";
import { FORM_EMOJI, RARITY_EMOJI, getCardStyles, getNameStyles } from "../lib/artifact-styles";
import { ArtifactDetailContent } from "../components/artifact-detail-content";

interface ArtifactPanelProps {
  nft: Nft;
}

// Always-visible, large artifact showcase for the auction room - what's
// actually up for sale deserves top billing here, unlike the click-through
// NftDetailModal used for quick peeks in Vault/Excavation/Bazaar.
export function ArtifactPanel({ nft }: ArtifactPanelProps) {
  const metadata = nft.metadata;
  const rarity = (metadata.rarity as string) || "common";
  const form = metadata.form as string | undefined;
  const cardStyles = getCardStyles(rarity);
  const nameStyles = getNameStyles(rarity);

  return (
    <div className={`rounded-lg border p-4 ${cardStyles}`}>
      <div className="flex h-40 items-center justify-center rounded bg-black/30 text-7xl md:h-48">{form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}</div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xl">{RARITY_EMOJI[rarity]}</span>
        <div className="min-w-0">
          <div className={`truncate text-base font-semibold ${nameStyles}`}>{metadata.name || `Artifact #${nft.tokenId.slice(-6)}`}</div>
          <div className={`text-xs capitalize ${nameStyles}`}>{rarity}</div>
        </div>
      </div>

      <div className="mt-4">
        <ArtifactDetailContent nft={nft} />
      </div>
    </div>
  );
}
