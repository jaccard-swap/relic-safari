import type { Nft } from "../lib/use-nfts";
import { getExplorerUrlForChain, getChainName } from "../lib/explorer";
import {
  FORM_EMOJI,
  QUALITY_BADGE,
  QUALITY_EMOJI,
  INSCRIPTION_STYLES,
  INSCRIPTION_EMOJI,
  AGE_STYLES,
  MATERIAL_STYLES,
  SITE_STYLES,
  RARITY_EMOJI,
  getNameStyles,
} from "../lib/artifact-styles";
import { InfoModal } from "./info-modal";

interface NftDetailModalProps {
  nft: Nft | null;
  onClose: () => void;
}

export function NftDetailModal({ nft, onClose }: NftDetailModalProps) {
  if (!nft) return null;

  const metadata = nft.metadata;
  const rarity = (metadata.rarity as string) || "common";
  const form = metadata.form as string;
  const quality = metadata.quality as string;
  const inscription = metadata.inscription as string;
  const age = metadata.age as string;
  const material = metadata.material as string;
  const site = metadata.site as string;
  const nameStyles = getNameStyles(rarity);

  const nftUrl = getExplorerUrlForChain(nft.chainId, nft.contractAddress, "nft", nft.tokenId);
  const contractUrl = getExplorerUrlForChain(nft.chainId, nft.contractAddress, "token");
  const explorerName = nftUrl || contractUrl ? "Explorer" : null;

  return (
    <InfoModal open={true} onClose={onClose} title={metadata.name || `Artifact #${nft.tokenId.slice(-6)}`} icon={form ? FORM_EMOJI[form] || "⚱️" : "⚱️"}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`text-lg ${nameStyles}`}>{RARITY_EMOJI[rarity]}</span>
        <span className={`text-sm font-semibold ${nameStyles}`}>{rarity}</span>
      </div>

      <div className="space-y-2">
        {age && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">Age</span>
            <span className={`text-xs ${AGE_STYLES[age]?.style}`}>
              {AGE_STYLES[age]?.emoji} {age}
            </span>
          </div>
        )}
        {material && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">Material</span>
            <span className={`text-xs ${MATERIAL_STYLES[material]?.style}`}>
              {MATERIAL_STYLES[material]?.emoji} {material}
            </span>
          </div>
        )}
        {quality && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">Quality</span>
            <span className={`text-xs ${QUALITY_BADGE[quality]}`}>
              {QUALITY_EMOJI[quality]} {quality}
            </span>
          </div>
        )}
        {form && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">Form</span>
            <span className="text-xs text-stone-300">
              {FORM_EMOJI[form]} {form}
            </span>
          </div>
        )}
        {inscription && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">Inscription</span>
            <span className={`text-xs ${INSCRIPTION_STYLES[inscription]}`}>
              {INSCRIPTION_EMOJI[inscription]} {inscription}
            </span>
          </div>
        )}
        {site && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-400">Origin</span>
            <span className={`text-xs ${SITE_STYLES[site]?.style}`}>
              {SITE_STYLES[site]?.emoji} {site.replace("-", " ")}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-stone-700 pt-3">
        <div className="space-y-1 text-[10px] text-stone-500">
          <div className="flex justify-between">
            <span>Token ID</span>
            {nftUrl ? (
              <a href={nftUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-400/80 hover:text-amber-300 hover:underline">
                {nft.tokenId.length > 12 ? `${nft.tokenId.slice(0, 6)}...${nft.tokenId.slice(-4)}` : nft.tokenId}
              </a>
            ) : (
              <span className="font-mono text-stone-400">{nft.tokenId.length > 12 ? `${nft.tokenId.slice(0, 6)}...${nft.tokenId.slice(-4)}` : nft.tokenId}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span>Chain</span>
            <span className="text-stone-400">{getChainName(nft.chainId)}</span>
          </div>
          <div className="flex justify-between">
            <span>Contract</span>
            {contractUrl ? (
              <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-amber-400/80 hover:text-amber-300 hover:underline">
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
              </a>
            ) : (
              <span className="font-mono text-stone-400">
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>

        {nftUrl && (
          <a
            href={nftUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block w-full rounded bg-stone-700/50 py-1.5 text-center text-[10px] font-medium text-amber-200/80 transition-colors hover:bg-stone-600/50"
          >
            View on {explorerName} ↗
          </a>
        )}
      </div>
    </InfoModal>
  );
}
