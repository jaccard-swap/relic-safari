interface MinHashPreviewProps {
  minHash: `0x${string}`[]
}

export function MinHashPreview({ minHash }: MinHashPreviewProps) {
  return (
    <div className="flex items-center gap-0.5">
      {minHash.map((h, i) => {
        // Color based on hash value (for visual variety)
        const value = BigInt(h)
        const maxVal = BigInt('0x' + 'f'.repeat(64))
        const normalized = Number((value * 1000n) / maxVal) / 1000
        const isDefault = h === ('0x' + 'f'.repeat(64))
        
        return (
          <div
            key={i}
            className={`w-6 h-3 rounded-sm transition-all ${
              isDefault 
                ? 'bg-stone-700' 
                : 'bg-gradient-to-r from-amber-600 to-purple-600'
            }`}
            style={{ opacity: isDefault ? 0.3 : 0.5 + normalized * 0.5 }}
            title={`Band ${i + 1}: ${h.slice(0, 10)}...`}
          />
        )
      })}
    </div>
  )
}

