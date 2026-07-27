import { TRAIT_POOLS } from '@shared/constants'
import { getNextUpgradeLevel, getTraitEssenceValue } from './traitUpgrades'

// Below this floor a fusion isn't attempted at all. The on-chain contract
// used to enforce a hardcoded 8-match floor itself (a flat
// `require(matches >= 8, ...)` in JaccardERC1155Facet.polymerase), but that
// function is gated by enforceIsContractOwner() - only this backend can ever
// call it - so re-deriving the match count on-chain was pure redundant gas.
// The floor now lives here only, and was lowered to 4 as part of the move to
// five even-width (4-match) resonance bands below.
export const POLYMERASE_MIN_MATCHES = 4

export type ResonanceTier = 'insufficient' | 'low' | 'medium' | 'high' | 'super'

interface TierDef {
  min: number
  tier: ResonanceTier
  multiplier: number
}

// Five even bands of 4 matches each (0-3/4-7/8-11/12-15/16-20, the last
// absorbing the extra value since 21 possible match counts don't divide
// evenly by 5). Checked highest-min-first. The multiplier scales the
// trait-derived essenceYield in even +0.5 steps - stronger resonance between
// the two fused artifacts yields more essence for the same fusion.
// `insufficient` never actually reaches a multiplier in practice since
// callers reject the fusion before computing a result, but it's included so
// getResonanceTier is total over all inputs.
const RESONANCE_TIERS: readonly TierDef[] = [
  { min: 16, tier: 'super', multiplier: 2.5 },
  { min: 12, tier: 'high', multiplier: 2 },
  { min: 8, tier: 'medium', multiplier: 1.5 },
  { min: POLYMERASE_MIN_MATCHES, tier: 'low', multiplier: 1 },
  { min: 0, tier: 'insufficient', multiplier: 0 },
]

export function getResonanceTier(matches: number): { tier: ResonanceTier; multiplier: number } {
  const found = RESONANCE_TIERS.find((t) => matches >= t.min)
  return found ? { tier: found.tier, multiplier: found.multiplier } : { tier: 'insufficient', multiplier: 0 }
}

// Minimum essence yield for any polymerization (consuming an NFT should
// always yield something), applied before tier scaling. 3x BASE_ESSENCE_VALUE
// (traitUpgrades.ts), same ratio as before its order-of-magnitude bump.
export const MIN_POLYMERIZATION_ESSENCE = 150

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Generate artifact name from traits: "Antediluvian Bronze Tablet"
export function generateArtifactName(traits: Record<string, string>): string {
  const parts: string[] = []

  if (traits.age) parts.push(cap(traits.age))
  if (traits.material) parts.push(cap(traits.material))

  if (traits.form) {
    parts.push(cap(traits.form))
  } else {
    parts.push('Fragment')
  }

  const fingerprint = Date.now().toString(36).slice(-4).toUpperCase()
  return `${parts.join(' ')} #${fingerprint}`
}

export interface PolymerizationResult {
  newMetadata: Record<string, any>
  upgradedTraits: Record<string, { from: string; to: string }>
  essenceYield: number
  tier: ResonanceTier
}

// Compute polymerization result: A + B → upgraded A + essence, with essence
// scaled by the MinHash resonance tier between the two artifacts.
// Rules:
// - A keeps all its traits
// - Matching upgradeable traits → upgrade A's trait
// - Matching non-upgradeable traits → convert to essence
// - Non-matching traits from B → convert to essence
export function computePolymerizationResult(
  targetMeta: Record<string, any>,
  consumedMeta: Record<string, any>,
  matches: number
): PolymerizationResult {
  const newMetadata = { ...targetMeta }
  const upgradedTraits: Record<string, { from: string; to: string }> = {}
  let essenceYield = 0

  for (const key of Object.keys(TRAIT_POOLS)) {
    const pool = TRAIT_POOLS[key]
    const targetVal = targetMeta[key] as string | undefined
    const consumedVal = consumedMeta[key] as string | undefined

    // Skip if B doesn't have this trait
    if (!consumedVal) continue

    if (targetVal === consumedVal) {
      // Matching trait
      if (pool.upgradeable) {
        // Upgrade A's trait if possible
        const upgrade = getNextUpgradeLevel(key, targetVal)
        if (upgrade) {
          newMetadata[key] = upgrade.value
          upgradedTraits[key] = { from: targetVal, to: upgrade.value }
        }
        // If maxed, matching upgradeable yields no essence (already absorbed into upgrade)
      } else {
        // Matching non-upgradeable → convert to essence
        essenceYield += getTraitEssenceValue(key, consumedVal)
      }
    } else {
      // Non-matching trait from B → convert to essence
      essenceYield += getTraitEssenceValue(key, consumedVal)
    }
  }

  // Regenerate name with new traits
  const traits = Object.fromEntries(
    Object.entries(newMetadata).filter(([k]) => k !== 'name')
  ) as Record<string, string>
  newMetadata.name = generateArtifactName(traits)

  const { tier, multiplier } = getResonanceTier(matches)
  const finalEssenceYield = Math.round(Math.max(essenceYield, MIN_POLYMERIZATION_ESSENCE) * multiplier)

  return { newMetadata, upgradedTraits, essenceYield: finalEssenceYield, tier }
}
