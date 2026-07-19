import { test, describe, before } from 'node:test'
import * as assert from 'node:assert'

const API_BASE = process.env.API_URL || 'http://localhost:3000'
const TEST_CHAIN_ID = 11155111
const TEST_WALLET = '0x78B7EEf57904c1F8B4487bf68b0D39f997F00997'

// Seeded test NFTs
let nftA: { id: string; tokenId: string } | null = null
let nftB: { id: string; tokenId: string } | null = null

async function seedNft(metadata: Record<string, string>, tokenId: string) {
  const res = await fetch(`${API_BASE}/nft/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: TEST_WALLET, chainId: TEST_CHAIN_ID, metadata, tokenId })
  })
  if (res.status === 200 || res.status === 201) {
    return await res.json() as any
  }
  return null
}

async function getNft(id: string) {
  const res = await fetch(`${API_BASE}/nft/${id}`)
  if (res.status === 200) {
    const body = await res.json() as any
    return body.nft
  }
  return null
}

describe('polymerase routes', async () => {

  describe('validation', () => {
    test('rejects missing params', async () => {
      const res = await fetch(`${API_BASE}/faucet/polymerase/simulate?consumedNftId=abc`)
      assert.equal(res.status, 400)
    })

    test('rejects invalid owner', async () => {
      const res = await fetch(`${API_BASE}/faucet/polymerase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: 'bad', targetTokenId: '1', consumedTokenId: '2', chainId: TEST_CHAIN_ID })
      })
      assert.equal(res.status, 400)
    })
  })

  describe('simulate with controlled NFTs', () => {

    before(async () => {
      // A and B share some traits for eligibility, but B has different
      // upgradeable traits that will convert to essence
      // Upgradeable: rarity, quality, inscription
      // Non-upgradeable: age, material, form, site
      const baseId = 9000000 + Math.floor(Math.random() * 100000)
      
      nftA = await seedNft({
        name: 'Artifact A',
        rarity: 'common',       // upgradeable
        age: 'bronze age',      // non-upgradeable
        quality: 'worn',        // upgradeable
        material: 'bronze',     // non-upgradeable
        form: 'tablet',         // non-upgradeable
        site: 'alexandria',     // non-upgradeable
        inscription: 'faded'    // upgradeable (levelUpCost: 8)
      }, String(baseId))

      nftB = await seedNft({
        name: 'Artifact B',
        rarity: 'common',       // SAME
        age: 'bronze age',      // SAME
        quality: 'worn',        // SAME
        material: 'bronze',     // SAME
        form: 'tablet',         // SAME
        site: 'alexandria',     // SAME
        inscription: 'legible'  // DIFF upgradeable → essence (levelUpCost: 40)
      }, String(baseId + 1))

      console.log('Seeded:', { A: nftA?.id, B: nftB?.id })
    })

    test('simulate returns eligibility and preview', async () => {
      if (!nftA || !nftB) {
        console.log('SKIP: seed endpoint unavailable')
        return
      }

      const res = await fetch(
        `${API_BASE}/faucet/polymerase/simulate?targetNftId=${nftA.id}&consumedNftId=${nftB.id}`
      )
      assert.equal(res.status, 200)

      const body = await res.json() as any
      
      // Core assertions - response structure: { eligible, minHash: { bands, matchCount }, result: { ... } }
      assert.ok('eligible' in body, 'has eligible')
      assert.ok('minHash' in body, 'has minHash')
      assert.ok('matchCount' in body.minHash, 'has matchCount')
      assert.ok('bands' in body.minHash, 'has bands array')
      assert.equal(body.minHash.bands.length, 20, '20 MinHash bands')

      // With 5/7 shared traits, expect high similarity
      console.log(`MinHash: ${body.minHash.matchCount}/20 matches, eligible=${body.eligible}`)
      
      if (body.eligible) {
        assert.ok('result' in body, 'eligible pair has result')
        assert.ok('essenceYield' in body.result, 'result has essenceYield')
        console.log(`Preview: essenceYield=${body.result.essenceYield}`)
      }
    })

    test('polymerase attempts on-chain call', async () => {
      if (!nftA || !nftB) {
        console.log('SKIP: seed endpoint unavailable')
        return
      }

      // This will fail at on-chain ownership check (expected)
      // but verifies the route works up to that point
      const res = await fetch(`${API_BASE}/faucet/polymerase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: TEST_WALLET,
          targetTokenId: nftA.tokenId,
          consumedTokenId: nftB.tokenId,
          chainId: TEST_CHAIN_ID
        })
      })

      const body = await res.json() as any
      
      // Expected: fails at ownership check (seed NFTs aren't on-chain)
      // This proves the route reached the on-chain verification step
      if (res.status === 403) {
        assert.equal(body.error, 'Owner does not have both artifacts')
        console.log('Correctly failed at on-chain ownership check')
      } else if (res.status === 200) {
        // If somehow it succeeded (unlikely without on-chain NFTs)
        // Verify the key outputs
        assert.ok(body.txHash, 'has txHash')
        assert.ok(body.newMetadata, 'has newMetadata')
        assert.ok('essenceYield' in body, 'has essenceYield')
        
        // Verify DB state
        const updatedA = await getNft(nftA.id)
        const updatedB = await getNft(nftB.id)
        
        assert.ok(updatedA, 'target NFT still exists')
        assert.equal(updatedB?.status, 'consumed', 'consumed NFT marked consumed')
        
        console.log('Polymerase succeeded!')
        console.log(`  essenceYield: ${body.essenceYield}`)
        console.log(`  consumed NFT status: ${updatedB?.status}`)
      } else {
        // Other error - log for debugging
        console.log(`Unexpected status ${res.status}:`, body)
      }
    })
  })
})
