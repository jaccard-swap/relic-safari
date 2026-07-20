import { test, describe, before } from 'node:test'
import * as assert from 'node:assert'
import { testToken } from '../helper'

const API_BASE = process.env.API_URL || 'http://localhost:3000'
// 31337 (local anvil), not Sepolia - this dev stack's SEPOLIA_RPC_URL is a
// deliberate unset.invalid placeholder (see .env), so any readContract call
// against 11155111 fails with a network error, not a clean on-chain
// response. 31337 is the chain actually running in docker-compose.dev.yaml.
const TEST_CHAIN_ID = 31337
const TEST_WALLET = '0x78B7EEf57904c1F8B4487bf68b0D39f997F00997'
const AUTH_HEADER = { Authorization: `Bearer ${testToken(TEST_WALLET)}` }

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

describe('polymerase routes', async () => {

  describe('validation', () => {
    test('rejects missing params', async () => {
      const res = await fetch(`${API_BASE}/faucet/polymerase/simulate?consumedNftId=abc`)
      assert.equal(res.status, 400)
    })

    test('rejects invalid owner', async () => {
      const res = await fetch(`${API_BASE}/faucet/polymerase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ owner: 'bad', targetTokenId: '1', consumedTokenId: '2', chainId: TEST_CHAIN_ID })
      })
      assert.equal(res.status, 400)
    })

    test('rejects unauthenticated request', async () => {
      const res = await fetch(`${API_BASE}/faucet/polymerase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: TEST_WALLET, targetTokenId: '1', consumedTokenId: '2', chainId: TEST_CHAIN_ID })
      })
      assert.equal(res.status, 401)
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

    // /simulate treats on-chain minHash as the source of truth (it re-reads
    // getMinHashByTokenId and syncs the DB from it), so it can't return an
    // eligibility preview for /nft/seed's DB-only fixtures - they were
    // never actually minted. getMinHashByTokenId doesn't revert for a
    // missing tokenId (it's a plain mapping read - JaccardERC1155Facet.sol
    // :77-80), it silently returns an all-zero bytes8[20]; without an
    // explicit zero-value check, two never-minted tokenIds would read back
    // identical signatures and falsely report 100% eligibility. That's now
    // caught explicitly (see faucet/index.ts) and returns a clean 404. Real
    // eligibility/threshold behavior is covered directly against
    // computeMinHash/countMinHashMatches in test/lib/minhash.test.ts
    // instead - this just confirms the route degrades gracefully rather
    // than reporting a false match for stale/unminted records.
    test('simulate 404s for artifacts that were never minted on-chain', async () => {
      if (!nftA || !nftB) {
        console.log('SKIP: seed endpoint unavailable')
        return
      }

      const res = await fetch(
        `${API_BASE}/faucet/polymerase/simulate?targetNftId=${nftA.id}&consumedNftId=${nftB.id}`
      )
      assert.equal(res.status, 404)
      const body = await res.json() as any
      assert.equal(body.error, 'One or both artifacts not found on-chain')
    })

    // Unlike getMinHashByTokenId (see the simulate test above), balanceOf
    // doesn't revert for a tokenId that was never minted - it just returns
    // 0. So this deterministically reaches and fails the on-chain ownership
    // check rather than 404ing earlier, which is what we want to verify:
    // the route gets all the way through validation/DB lookups to the
    // on-chain check before rejecting.
    test('polymerase fails ownership check for artifacts that were never minted on-chain', async () => {
      if (!nftA || !nftB) {
        console.log('SKIP: seed endpoint unavailable')
        return
      }

      const res = await fetch(`${API_BASE}/faucet/polymerase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({
          owner: TEST_WALLET,
          targetTokenId: nftA.tokenId,
          consumedTokenId: nftB.tokenId,
          chainId: TEST_CHAIN_ID
        })
      })

      assert.equal(res.status, 403)
      const body = await res.json() as any
      assert.equal(body.error, 'Owner does not have both artifacts')
    })
  })
})
