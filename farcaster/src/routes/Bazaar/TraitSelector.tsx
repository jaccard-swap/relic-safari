import { useState, useMemo } from 'react'
import { TRAIT_OPTIONS } from '@shared/constants'
import { TraitChip, TRAIT_EMOJI } from './TraitChip'

interface TraitSelectorProps {
  selectedTraits: Record<string, string>
  onAddTrait: (key: string, value: string) => void
  onRemoveTrait: (key: string) => void
}

export function TraitSelector({ selectedTraits, onAddTrait, onRemoveTrait }: TraitSelectorProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  // Generate suggestions based on input
  const suggestions = useMemo(() => {
    if (!inputValue) return []
    
    const lower = inputValue.toLowerCase()
    const results: { key: string; value: string; display: string }[] = []
    
    for (const [key, values] of Object.entries(TRAIT_OPTIONS)) {
      // Skip already selected traits
      if (selectedTraits[key]) continue
      
      // If input matches trait key, show all values
      if (key.includes(lower)) {
        for (const v of values.slice(0, 3)) {
          results.push({ key, value: v, display: `${key}:${v}` })
        }
      }
      
      // If input matches a value, show that specific match
      for (const v of values) {
        if (v.includes(lower) && !results.find(r => r.key === key && r.value === v)) {
          results.push({ key, value: v, display: `${key}:${v}` })
        }
      }
      
      // If input has colon, parse it
      if (lower.includes(':')) {
        const [k, val] = lower.split(':')
        if (key.includes(k)) {
          for (const v of values) {
            if (v.includes(val || '') && !results.find(r => r.key === key && r.value === v)) {
              results.push({ key, value: v, display: `${key}:${v}` })
            }
          }
        }
      }
    }
    
    return results.slice(0, 8)
  }, [inputValue, selectedTraits])

  const handleSelect = (key: string, value: string) => {
    onAddTrait(key, value)
    setInputValue('')
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      handleSelect(suggestions[0].key, suggestions[0].value)
    }
  }
  
  return (
    <div className="relative">
      {/* Selected traits as chips */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {Object.entries(selectedTraits).map(([key, value]) => (
          <TraitChip 
            key={key} 
            traitKey={key} 
            value={value} 
            onRemove={() => onRemoveTrait(key)}
          />
        ))}
      </div>
      
      {/* Input field */}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true) }}
        onKeyDown={handleKeyDown}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        placeholder="Type trait... (e.g. rarity:legendary)"
        className="w-full px-2 py-1.5 bg-stone-900/50 border border-stone-700 rounded text-[10px] text-white placeholder-stone-500 focus:outline-none focus:border-amber-700"
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-stone-800 border border-stone-700 rounded shadow-lg max-h-32 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => handleSelect(s.key, s.value)}
              className="w-full px-2 py-1 text-left text-[10px] hover:bg-amber-900/30 flex items-center gap-1.5"
            >
              <span>{TRAIT_EMOJI[s.key] || '🔹'}</span>
              <span className="text-amber-300">{s.key}:</span>
              <span className="text-stone-300">{s.value}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Quick add buttons */}
      {Object.keys(selectedTraits).length === 0 && !inputValue && (
        <div className="mt-1.5">
          <div className="text-[8px] text-stone-500 mb-1">Quick add:</div>
          <div className="flex flex-wrap gap-1">
            {['rarity:legendary', 'material:orichalcum', 'quality:pristine'].map((preset) => {
              const [k, v] = preset.split(':')
              return (
                <button
                  key={preset}
                  onClick={() => onAddTrait(k, v)}
                  className="px-1.5 py-0.5 text-[8px] bg-stone-700/50 hover:bg-amber-900/30 border border-stone-600/50 rounded text-stone-400 hover:text-amber-300"
                >
                  {preset}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

