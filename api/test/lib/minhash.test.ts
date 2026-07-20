// Unit tests for the MinHash implementation in @shared/constants - the core
// similarity primitive behind polymerase eligibility, direct-bid matching,
// and standing buy orders. Previously untested anywhere in the repo (see
// test/routes/polymerase.test.ts for why the e2e route can't exercise real
// eligibility without on-chain fixtures).
import { test, describe } from 'node:test'
import * as assert from 'node:assert'
import { computeMinHash, countMinHashMatches, MINHASH_BANDS } from '@shared/constants'

describe('computeMinHash', () => {
  test('returns MINHASH_BANDS bytes8 values', () => {
    const hash = computeMinHash({ rarity: 'common', material: 'bronze' })
    assert.equal(hash.length, MINHASH_BANDS)
    for (const band of hash) {
      assert.match(band, /^0x[0-9a-f]{16}$/, `band ${band} should be a lowercase bytes8 hex string`)
    }
  })

  test('is deterministic for the same traits', () => {
    const traits = { rarity: 'legendary', age: 'bronze age', material: 'gold' }
    assert.deepEqual(computeMinHash(traits), computeMinHash({ ...traits }))
  })

  test('is invariant to trait key order', () => {
    const a = computeMinHash({ rarity: 'common', age: 'bronze age', material: 'bronze', form: 'tablet' })
    const b = computeMinHash({ form: 'tablet', material: 'bronze', age: 'bronze age', rarity: 'common' })
    assert.deepEqual(a, b)
  })

  test('ignores name/image/description', () => {
    const a = computeMinHash({ rarity: 'common', name: 'Foo', image: 'x.png', description: 'desc' })
    const b = computeMinHash({ rarity: 'common' })
    assert.deepEqual(a, b)
  })

  test('traits with zero real features hash to the all-0xff sentinel', () => {
    const hash = computeMinHash({ name: 'Nameless', image: 'x.png', description: 'desc' })
    assert.equal(hash.length, MINHASH_BANDS)
    for (const band of hash) assert.equal(band, '0x' + 'f'.repeat(16))
  })

  test('two artifacts sharing 6/7 traits match on well over the polymerase threshold', () => {
    // Same fixture as test/routes/polymerase.test.ts's seed data - only
    // `inscription` differs between A and B.
    const a = computeMinHash({
      rarity: 'common', age: 'bronze age', quality: 'worn',
      material: 'bronze', form: 'tablet', site: 'alexandria', inscription: 'faded',
    })
    const b = computeMinHash({
      rarity: 'common', age: 'bronze age', quality: 'worn',
      material: 'bronze', form: 'tablet', site: 'alexandria', inscription: 'legible',
    })
    const matches = countMinHashMatches(a, b)
    // Deterministic given the fixed MINHASH_SEEDS - not a probabilistic
    // range check. If this ever changes, either the algorithm or the seeds
    // changed, and every existing on-chain minHash comparison is now wrong.
    assert.equal(matches, 12)
  })

  test('artifacts with completely disjoint trait values match on zero bands', () => {
    const a = computeMinHash({
      rarity: 'common', age: 'bronze age', quality: 'worn',
      material: 'bronze', form: 'tablet', site: 'alexandria', inscription: 'faded',
    })
    const c = computeMinHash({
      rarity: 'legendary', age: 'antediluvian', quality: 'immaculate',
      material: 'orichalcum', form: 'scepter', site: 'frozen-vault', inscription: 'glowing',
    })
    assert.equal(countMinHashMatches(a, c), 0)
  })
})

describe('countMinHashMatches', () => {
  const band = (n: number) => `0x${n.toString(16).padStart(16, '0')}`
  const bands = (values: number[]) => values.map(band)
  const sameBands = Array.from({ length: MINHASH_BANDS }, (_, i) => i)

  test('identical signatures match on every band', () => {
    const sig = bands(sameBands)
    assert.equal(countMinHashMatches(sig, [...sig]), MINHASH_BANDS)
  })

  test('is case-insensitive', () => {
    const sig = bands(sameBands)
    const upper = sig.map((h) => h.toUpperCase())
    assert.equal(countMinHashMatches(sig, upper), MINHASH_BANDS)
  })

  test('counts exactly at the polymerase eligibility boundary (8/20)', () => {
    const a = bands(sameBands)
    // First 8 bands identical, remaining 12 forced to differ.
    const b = bands(sameBands.map((n, i) => (i < 8 ? n : n + 1000)))
    assert.equal(countMinHashMatches(a, b), 8)
  })

  test('one below the boundary (7/20) does not meet it', () => {
    const a = bands(sameBands)
    const b = bands(sameBands.map((n, i) => (i < 7 ? n : n + 1000)))
    const matches = countMinHashMatches(a, b)
    assert.equal(matches, 7)
    assert.ok(matches < 8, 'should fall short of the polymerase threshold')
  })

  test('returns 0 for mismatched lengths rather than comparing a truncated prefix', () => {
    const a = bands(sameBands)
    const short = bands(sameBands.slice(0, 5))
    assert.equal(countMinHashMatches(a, short), 0)
  })
})
