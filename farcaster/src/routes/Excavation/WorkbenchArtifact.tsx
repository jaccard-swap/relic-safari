import type { Nft, NftMetadata } from '../../stores/nftStore'
import { 
  FORM_EMOJI, 
  RARITY_EMOJI,
  QUALITY_EMOJI,
  AGE_STYLES,
  MATERIAL_STYLES,
  INSCRIPTION_EMOJI,
  SITE_STYLES,
  getNameStyles 
} from '../../utils/artifactStyles'

interface WorkbenchArtifactProps {
  nft: Nft
  role: 'target' | 'consumed'
}

export function WorkbenchArtifact({ nft, role }: WorkbenchArtifactProps) {
  const metadata = nft.metadata as NftMetadata
  const rarity = metadata.rarity as string || 'common'
  const form = metadata.form as string
  const nameStyles = getNameStyles(rarity)

  const borderColor = role === 'target' ? 'border-emerald-500/50' : 'border-cyan-500/50'
  const bgColor = role === 'target' ? 'bg-emerald-950/30' : 'bg-cyan-950/30'
  const labelColor = role === 'target' ? 'text-emerald-400' : 'text-cyan-400'

  // Collect trait emojis with their labels for tooltips
  const traits: { emoji: string; label: string }[] = []
  if (metadata.rarity) traits.push({ emoji: RARITY_EMOJI[metadata.rarity as string] || '◆', label: metadata.rarity as string })
  if (metadata.age) traits.push({ emoji: AGE_STYLES[metadata.age as string]?.emoji || '📅', label: metadata.age as string })
  if (metadata.quality) traits.push({ emoji: QUALITY_EMOJI[metadata.quality as string] || '✧', label: metadata.quality as string })
  if (metadata.material) traits.push({ emoji: MATERIAL_STYLES[metadata.material as string]?.emoji || '🪨', label: metadata.material as string })
  if (metadata.site) traits.push({ emoji: SITE_STYLES[metadata.site as string]?.emoji || '📍', label: metadata.site as string })
  if (metadata.inscription) traits.push({ emoji: INSCRIPTION_EMOJI[metadata.inscription as string] || '📜', label: metadata.inscription as string })

  return (
    <div className={`p-1.5 rounded border ${borderColor} ${bgColor}`}>
      {/* Role label on top */}
      <div className={`text-[8px] font-bold ${labelColor} mb-0.5`}>
        {role === 'target' ? '◆ TARGET' : '◇ CATALYST'}
      </div>
      
      {/* Name */}
      <div className={`text-[9px] font-medium truncate ${nameStyles}`}>
        {metadata.name || `Artifact #${nft.tokenId.slice(-6)}`}
      </div>
      
      {/* Form emoji + trait emojis */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-base" title={form || 'artifact'}>
          {form ? FORM_EMOJI[form] || '⚱️' : '⚱️'}
        </span>
        <div className="flex flex-wrap gap-0.5">
          {traits.map(({ emoji, label }, i) => (
            <span key={i} className="text-[10px] cursor-default" title={label}>
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

