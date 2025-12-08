import { useChains } from 'wagmi'
import type { Nft, NftMetadata } from '../stores/nftStore'
import { InfoModal } from './InfoModal'
import { getExplorerUrl } from '../utils/explorer'
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
  getNameStyles 
} from '../utils/artifactStyles'

interface NftDetailModalProps {
  nft: Nft | null
  onClose: () => void
}

export function NftDetailModal({ nft, onClose }: NftDetailModalProps) {
  const chains = useChains()
  
  if (!nft) return null
  
  const metadata = nft.metadata as NftMetadata
  const rarity = metadata.rarity as string || 'common'
  const form = metadata.form as string
  const quality = metadata.quality as string
  const inscription = metadata.inscription as string
  const age = metadata.age as string
  const material = metadata.material as string
  const site = metadata.site as string
  const nameStyles = getNameStyles(rarity)
  
  const chain = chains.find(c => c.id === nft.chainId)
  const nftUrl = getExplorerUrl(chain, nft.contractAddress, 'nft', nft.tokenId)
  const contractUrl = getExplorerUrl(chain, nft.contractAddress, 'token')
  const explorerName = chain?.blockExplorers?.default?.name || 'Explorer'

  return (
    <InfoModal 
      open={true} 
      onClose={onClose} 
      title={metadata.name || `Artifact #${nft.tokenId.slice(-6)}`}
      icon={form ? FORM_EMOJI[form] || '⚱️' : '⚱️'}
    >
      {/* Rarity badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-lg ${nameStyles}`}>{RARITY_EMOJI[rarity]}</span>
        <span className={`text-sm font-semibold ${nameStyles}`}>{rarity}</span>
      </div>

      {/* Traits grid */}
      <div className="space-y-2">
        {age && (
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-xs">Age</span>
            <span className={`text-xs ${AGE_STYLES[age]?.style}`}>{AGE_STYLES[age]?.emoji} {age}</span>
          </div>
        )}
        {material && (
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-xs">Material</span>
            <span className={`text-xs ${MATERIAL_STYLES[material]?.style}`}>{MATERIAL_STYLES[material]?.emoji} {material}</span>
          </div>
        )}
        {quality && (
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-xs">Quality</span>
            <span className={`text-xs ${QUALITY_BADGE[quality]}`}>{QUALITY_EMOJI[quality]} {quality}</span>
          </div>
        )}
        {form && (
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-xs">Form</span>
            <span className="text-xs text-stone-300">{FORM_EMOJI[form]} {form}</span>
          </div>
        )}
        {inscription && (
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-xs">Inscription</span>
            <span className={`text-xs ${INSCRIPTION_STYLES[inscription]}`}>{INSCRIPTION_EMOJI[inscription]} {inscription}</span>
          </div>
        )}
        {site && (
          <div className="flex items-center justify-between">
            <span className="text-stone-400 text-xs">Origin</span>
            <span className={`text-xs ${SITE_STYLES[site]?.style}`}>{SITE_STYLES[site]?.emoji} {site.replace('-', ' ')}</span>
          </div>
        )}
      </div>

      {/* Technical details with explorer links */}
      <div className="mt-4 pt-3 border-t border-stone-700">
        <div className="text-stone-500 text-[10px] space-y-1">
          <div className="flex justify-between">
            <span>Token ID</span>
            {nftUrl ? (
              <a
                href={nftUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-amber-400/80 hover:text-amber-300 hover:underline"
              >
                {nft.tokenId.length > 12 ? `${nft.tokenId.slice(0, 6)}...${nft.tokenId.slice(-4)}` : nft.tokenId}
              </a>
            ) : (
              <span className="font-mono text-stone-400">
                {nft.tokenId.length > 12 ? `${nft.tokenId.slice(0, 6)}...${nft.tokenId.slice(-4)}` : nft.tokenId}
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span>Chain</span>
            <span className="text-stone-400">
              {explorerName} ({nft.chainId === 84532 ? 'Base Sepolia' : nft.chainId === 11155111 ? 'Sepolia' : `${nft.chainId}`})
            </span>
          </div>
          <div className="flex justify-between">
            <span>Contract</span>
            {contractUrl ? (
              <a
                href={contractUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-amber-400/80 hover:text-amber-300 hover:underline"
              >
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
              </a>
            ) : (
              <span className="font-mono text-stone-400">
                {nft.contractAddress.slice(0, 6)}...{nft.contractAddress.slice(-4)}
              </span>
            )}
          </div>
        </div>
        
        {/* View on Explorer button */}
        {nftUrl && (
          <a
            href={nftUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block w-full py-1.5 bg-stone-700/50 hover:bg-stone-600/50 text-amber-200/80 text-[10px] font-medium rounded text-center transition-colors"
          >
            View on {explorerName} ↗
          </a>
        )}
      </div>
    </InfoModal>
  )
}

