// Unit tests for the resonance-tier essence scaling introduced alongside the
// removal of JaccardERC1155Facet.polymerase's on-chain `matches >= 8` check.
// enforceIsContractOwner() already restricts that function to this backend,
// so POLYMERASE_MIN_MATCHES and the tier multipliers below are now the only
// place eligibility/reward scaling is enforced - see lib/polymerase.ts.
import { test, describe } from 'node:test'
import * as assert from 'node:assert'
import {
  computePolymerizationResult,
  getResonanceTier,
  MIN_POLYMERIZATION_ESSENCE,
  POLYMERASE_MIN_MATCHES,
} from '../../src/lib/polymerase'

describe('getResonanceTier', () => {
  test('below the floor is insufficient', () => {
    assert.deepEqual(getResonanceTier(0), { tier: 'insufficient', multiplier: 0 })
    assert.deepEqual(getResonanceTier(3), { tier: 'insufficient', multiplier: 0 })
  })

  test('POLYMERASE_MIN_MATCHES is the low-tier floor', () => {
    assert.equal(POLYMERASE_MIN_MATCHES, 4)
    assert.deepEqual(getResonanceTier(4), { tier: 'low', multiplier: 1 })
    assert.deepEqual(getResonanceTier(7), { tier: 'low', multiplier: 1 })
  })

  test('8-11 is medium', () => {
    assert.deepEqual(getResonanceTier(8), { tier: 'medium', multiplier: 1.5 })
    assert.deepEqual(getResonanceTier(11), { tier: 'medium', multiplier: 1.5 })
  })

  test('12-15 is high', () => {
    assert.deepEqual(getResonanceTier(12), { tier: 'high', multiplier: 2 })
    assert.deepEqual(getResonanceTier(15), { tier: 'high', multiplier: 2 })
  })

  test('16-20 is super', () => {
    assert.deepEqual(getResonanceTier(16), { tier: 'super', multiplier: 2.5 })
    assert.deepEqual(getResonanceTier(20), { tier: 'super', multiplier: 2.5 })
  })
})

describe('computePolymerizationResult essence scaling', () => {
  // Four non-upgradeable traits (age, material, form, site) always contribute
  // BASE_ESSENCE_VALUE (5) each regardless of match/mismatch, so this pair
  // yields a base essenceYield of exactly 20 before any tier scaling -
  // clean, deterministic, and independent of the upgradeable-trait branch.
  const target = { name: 'Target', age: 'bronze age', material: 'bronze', form: 'tablet', site: 'sunken-temple' }
  const consumed = { name: 'Consumed', age: 'iron age', material: 'gold', form: 'idol', site: 'desert-tomb' }

  test('insufficient tier zeroes out essence entirely', () => {
    const result = computePolymerizationResult(target, consumed, 3)
    assert.equal(result.tier, 'insufficient')
    assert.equal(result.essenceYield, 0)
  })

  test('low tier (4-7 matches) applies a 1x multiplier', () => {
    const atFloor = computePolymerizationResult(target, consumed, 4)
    const atCeiling = computePolymerizationResult(target, consumed, 7)
    assert.equal(atFloor.tier, 'low')
    assert.equal(atFloor.essenceYield, 20)
    assert.equal(atCeiling.tier, 'low')
    assert.equal(atCeiling.essenceYield, 20)
  })

  test('medium tier (8-11 matches) applies a 1.5x multiplier', () => {
    const result = computePolymerizationResult(target, consumed, 8)
    assert.equal(result.tier, 'medium')
    assert.equal(result.essenceYield, 30) // 20 * 1.5
  })

  test('high tier (12-15 matches) applies a 2x multiplier', () => {
    const result = computePolymerizationResult(target, consumed, 12)
    assert.equal(result.tier, 'high')
    assert.equal(result.essenceYield, 40) // 20 * 2
  })

  test('super tier (16-20 matches) applies a 2.5x multiplier', () => {
    const result = computePolymerizationResult(target, consumed, 20)
    assert.equal(result.tier, 'super')
    assert.equal(result.essenceYield, 50) // 20 * 2.5
  })

  test('the minimum essence floor is applied before tier scaling, not after', () => {
    // A single non-upgradeable trait yields a base essence of 5, well under
    // MIN_POLYMERIZATION_ESSENCE (15). If the floor were applied after
    // scaling instead of before, super tier would still show 15; applied
    // before, super tier scales the floored value up to 37.5 -> 38.
    const sparseTarget = { name: 'Target', age: 'bronze age' }
    const sparseConsumed = { name: 'Consumed', age: 'iron age' }

    const low = computePolymerizationResult(sparseTarget, sparseConsumed, 4)
    assert.equal(low.essenceYield, MIN_POLYMERIZATION_ESSENCE)

    const superTier = computePolymerizationResult(sparseTarget, sparseConsumed, 20)
    assert.equal(superTier.essenceYield, Math.round(MIN_POLYMERIZATION_ESSENCE * 2.5))
  })

  test('a non-integer scaled result rounds rather than truncating', () => {
    // Adds a mismatched upgradeable trait (quality: fragmented -> worn,
    // levelUpCost 5) on top of the 20 base essence, for 25 total.
    // 25 * 1.5 (medium) = 37.5, which must round up to 38, not down to 37.
    const targetWithQuality = { ...target, quality: 'fragmented' }
    const consumedWithQuality = { ...consumed, quality: 'worn' }

    const result = computePolymerizationResult(targetWithQuality, consumedWithQuality, 8)
    assert.equal(result.tier, 'medium')
    assert.equal(result.essenceYield, 38)
  })
})

describe('computePolymerizationResult trait upgrades (unaffected by tier scaling)', () => {
  test('a matching upgradeable trait upgrades without contributing essence', () => {
    const target = { name: 'Target', rarity: 'common' }
    const consumed = { name: 'Consumed', rarity: 'common' }

    const result = computePolymerizationResult(target, consumed, 20)
    assert.deepEqual(result.upgradedTraits.rarity, { from: 'common', to: 'uncommon' })
    assert.equal(result.newMetadata.rarity, 'uncommon')
    // Base essence is 0 (the only trait present matched and upgraded
    // instead), floored to MIN_POLYMERIZATION_ESSENCE, then still scaled by
    // the super-tier multiplier - the floor and the tier multiplier compose
    // independently of whichever traits actually produced essence.
    assert.equal(result.essenceYield, Math.round(MIN_POLYMERIZATION_ESSENCE * 2.5))
  })

  test('an already-maxed matching upgradeable trait yields neither an upgrade nor essence', () => {
    const target = { name: 'Target', rarity: 'legendary' }
    const consumed = { name: 'Consumed', rarity: 'legendary' }

    const result = computePolymerizationResult(target, consumed, 20)
    assert.deepEqual(result.upgradedTraits, {})
    assert.equal(result.newMetadata.rarity, 'legendary')
  })

  test('a matching non-upgradeable trait still converts to essence', () => {
    // Unlike upgradeable traits, non-upgradeable ones (age, material, form,
    // site) always yield essence on a match - there's no trait level to
    // upgrade into instead.
    const target = { name: 'Target', age: 'bronze age' }
    const consumed = { name: 'Consumed', age: 'bronze age' }

    const result = computePolymerizationResult(target, consumed, 4)
    assert.equal(result.tier, 'low')
    assert.equal(result.essenceYield, MIN_POLYMERIZATION_ESSENCE) // floor(5) * 1
  })
})
