import type { Nft } from "../lib/use-nfts";
import { FORM_EMOJI, RARITY_EMOJI, getNameStyles } from "../lib/artifact-styles";
import { InfoModal } from "./info-modal";
import { ArtifactDetailContent } from "./artifact-detail-content";

interface NftDetailModalProps {
  nft: Nft | null;
  onClose: () => void;
}

export function NftDetailModal({ nft, onClose }: NftDetailModalProps) {
  if (!nft) return null;

  const metadata = nft.metadata;
  const rarity = (metadata.rarity as string) || "common";
  const form = metadata.form as string;
  const nameStyles = getNameStyles(rarity);

  return (
    <InfoModal open={true} onClose={onClose} title={metadata.name || `Artifact #${nft.tokenId.slice(-6)}`} icon={form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}>
      <div className="mb-4 flex items-center gap-3">
        <span className={`text-lg ${nameStyles}`}>{RARITY_EMOJI[rarity]}</span>
        <span className={`text-sm font-semibold ${nameStyles}`}>{rarity}</span>
      </div>

      <ArtifactDetailContent nft={nft} />
    </InfoModal>
  );
}
