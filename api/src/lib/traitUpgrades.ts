import { TRAIT_POOLS } from '@shared/constants'

// Base essence value for a non-upgradeable trait, or an upgradeable trait
// that's already maxed. Shared by polymerase (essence yield from consumed
// traits) and Forge (nothing currently reads this for cost - upgrade cost
// comes from getNextUpgradeLevel below - but it lives here since it's the
// same TRAIT_POOLS-walking concern).
const BASE_ESSENCE_VALUE = 50

// Forge (direct Essence spend, no second artifact) charges this multiple of
// a trait level's raw levelUpCost - polymerase (fusing two artifacts) grants
// that same raw amount for free (matching traits) or as yield (non-matching
// traits) with no multiplier. This gap is deliberate: fusing artifacts is
// meant to be the efficient way to level up traits, Forge is the convenience
// premium for players who don't want to burn a second artifact.
const FORGE_COST_MULTIPLIER = 4

export function getTraitEssenceValue(traitKey: string, value: string): number {
  const pool = TRAIT_POOLS[traitKey]
  if (!pool) return 0

  if (!pool.upgradeable) {
    // Non-upgradeable traits yield base essence
    return BASE_ESSENCE_VALUE
  }

  const level = pool.values.find((v) => v.value === value)
  // Upgradeable traits yield their levelUpCost as essence
  return level?.levelUpCost || BASE_ESSENCE_VALUE
}

// Get next upgrade level for a trait, and Forge's cost to buy it directly
// (returns null if maxed or not upgradeable). Also used by polymerase for
// the free match-upgrade path, which reads only `.value`, never `.cost` -
// safe to keep FORGE_COST_MULTIPLIER folded into this single cost figure.
export function getNextUpgradeLevel(traitKey: string, currentValue: string): { value: string; cost: number } | null {
  const pool = TRAIT_POOLS[traitKey]
  if (!pool || !pool.upgradeable) return null

  const currentIdx = pool.values.findIndex((v) => v.value === currentValue)
  if (currentIdx < 0 || currentIdx >= pool.values.length - 1) return null

  const nextLevel = pool.values[currentIdx + 1]
  return { value: nextLevel.value, cost: (nextLevel.levelUpCost || 0) * FORGE_COST_MULTIPLIER }
}

// Every upgradeable trait on this artifact is at its max level - Overflow
// unlocks only once there's nothing left in TRAIT_POOLS to spend Essence on.
export function isFullyMaxed(metadata: Record<string, any>): boolean {
  return Object.keys(TRAIT_POOLS)
    .filter((key) => TRAIT_POOLS[key].upgradeable)
    .every((key) => getNextUpgradeLevel(key, metadata[key]) === null)
}

// Uncapped counter, cost grows linearly so it stays a real Essence sink
// rather than a flat-price infinite dump. Tune BASE/STEP as the economy
// needs; this is intentionally simple to start. No polymerase equivalent
// exists for Overflow (it's Forge-only, unlocked only once every real trait
// is maxed) so FORGE_COST_MULTIPLIER doesn't apply here - these are already
// the full cost.
const OVERFLOW_BASE_COST = 200
const OVERFLOW_COST_STEP = 50

export function getOverflowCost(currentLevel: number): number {
  return OVERFLOW_BASE_COST + currentLevel * OVERFLOW_COST_STEP
}
