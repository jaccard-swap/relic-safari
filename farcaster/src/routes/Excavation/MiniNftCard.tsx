import type { Nft, NftMetadata } from '../../stores/nftStore'
import { 
  FORM_EMOJI, 
  RARITY_EMOJI,
  getCardStyles, 
  getNameStyles 
} from '../../utils/artifactStyles'

interface MiniNftCardProps {
  nft: Nft
  selected?: boolean
  role?: 'target' | 'consumed'
  onSelect?: () => void
  onClick?: () => void
}

export function MiniNftCard({ nft, selected, role, onSelect, onClick }: MiniNftCardProps) {
  const metadata = nft.metadata as NftMetadata
  const rarity = metadata.rarity as string || 'common'
  const form = metadata.form as string
  const cardStyles = getCardStyles(rarity)
  const nameStyles = getNameStyles(rarity)

  const ringColor = role === 'target' ? 'ring-emerald-400' : role === 'consumed' ? 'ring-cyan-400' : 'ring-amber-400'

  const handleClick = onSelect || onClick

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-1.5 p-1 rounded border text-left transition-all ${cardStyles} ${
        selected ? `ring-2 ${ringColor}` : ''
      } ${handleClick ? 'hover:brightness-110 cursor-pointer' : ''}`}
    >
      <div className="w-5 h-5 flex items-center justify-center bg-black/30 rounded text-xs">
        {form ? FORM_EMOJI[form] || '⚱️' : '⚱️'}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[9px] truncate ${nameStyles}`}>
          {RARITY_EMOJI[rarity]} {metadata.name || `#${nft.tokenId.slice(-6)}`}
        </div>
      </div>
      {role === 'target' && <span className="text-emerald-400 text-[8px] font-medium">TARGET</span>}
      {role === 'consumed' && <span className="text-cyan-400 text-[8px] font-medium">FUSE</span>}
    </button>
  )
}

