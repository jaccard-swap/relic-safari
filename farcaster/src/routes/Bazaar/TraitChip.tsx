export const TRAIT_EMOJI: Record<string, string> = {
  rarity: '💎',
  age: '📜',
  quality: '✨',
  material: '🪨',
  form: '⚱️',
  site: '🏛️',
  inscription: '✍️',
}

interface TraitChipProps {
  traitKey: string
  value: string
  onRemove: () => void 
}

export function TraitChip({ traitKey, value, onRemove }: TraitChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-amber-900/50 to-stone-800/50 border border-amber-700/30 text-[9px]">
      <span>{TRAIT_EMOJI[traitKey] || '🔹'}</span>
      <span className="text-amber-200">{traitKey}:</span>
      <span className="text-stone-300">{value}</span>
      <button onClick={onRemove} className="ml-0.5 text-stone-500 hover:text-red-400">×</button>
    </span>
  )
}

