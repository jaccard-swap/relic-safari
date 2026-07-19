import { TRAIT_KEYS, TRAIT_OPTIONS } from "@shared/constants";
import { TRAIT_KEY_EMOJI } from "../lib/artifact-styles";

interface TraitSelectorProps {
  selected: Record<string, string>;
  onChange: (traits: Record<string, string>) => void;
}

export function TraitSelector({ selected, onChange }: TraitSelectorProps) {
  function setTrait(key: string, value: string) {
    const next = { ...selected };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  }

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {TRAIT_KEYS.map((key) => (
        <div key={key}>
          <label className="mb-0.5 block text-[8px] text-stone-500">
            {TRAIT_KEY_EMOJI[key]} {key}
          </label>
          <select
            value={selected[key] ?? ""}
            onChange={(e) => setTrait(key, e.target.value)}
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-[9px] text-stone-300 focus:border-amber-600 focus:outline-none"
          >
            <option value="">Any</option>
            {TRAIT_OPTIONS[key].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

interface TraitChipProps {
  traitKey: string;
  value: string;
  onRemove: () => void;
}

export function TraitChip({ traitKey, value, onRemove }: TraitChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-700/50 px-2 py-0.5 text-[9px] text-stone-300">
      {TRAIT_KEY_EMOJI[traitKey]} {value}
      <button type="button" onClick={onRemove} className="text-stone-500 hover:text-red-400">
        ✕
      </button>
    </span>
  );
}
