import { test, describe, before } from 'node:test'
import * as assert from 'node:assert'
import { computeMinHash, countMinHashMatches, MINHASH_BANDS } from '@shared/constants'
import { testToken } from '../helper'

const API_BASE = process.env.API_URL || 'http://localhost:3000'
// 31337 (local anvil) - matches the convention in polymerase.test.ts. These
// tests never touch the chain (standing bids are DB-only until attached),
// so the chainId only needs to be consistent across fixtures.
const TEST_CHAIN_ID = 31337

const BIDDER = '0x78B7EEf57904c1F8B4487bf68b0D39f997F00997'
const AUCTIONEER = '0x1234567890123456789012345678901234567890'
const BIDDER_AUTH = { Authorization: `Bearer ${testToken(BIDDER)}` }
const AUCTIONEER_AUTH = { Authorization: `Bearer ${testToken(AUCTIONEER)}` }

function futureDeadline(seconds = 3600): number {
  return Math.floor(Date.now() / 1000) + seconds
}

function dummyErc20Permit(owner: string) {
  return {
    owner,
    spender: '0x000000000000000000000000000000000000dE',
    value: '1000000000000000000',
    deadline: futureDeadline(),
    v: 27,
    r: '0x' + '11'.repeat(32),
    s: '0x' + '22'.repeat(32),
  }
}

// POST /bids/ never verifies the signature on-chain (it just stores it and
// relies on attachStandingBids -> placeBid -> eventual on-chain consumeAuction
// to be the real signature-checking boundary), so placeholder salt/signature
// values are fine here - same reasoning as polymerase.test.ts's fixtures.
function standingBidBody(overrides: Record<string, unknown> = {}) {
  const traits = { rarity: 'legendary', material: 'orichalcum', age: 'bronze age' }
  const bidder = (overrides.bidder as string) ?? BIDDER
  return {
    bidder,
    chainId: TEST_CHAIN_ID,
    amount: '1000000000000000000',
    targetMinHash: computeMinHash(traits),
    minMatches: 2,
    desiredTraits: traits,
    salt: '0x' + '33'.repeat(4),
    deadline: futureDeadline(),
    signature: '0x' + '44'.repeat(65),
    erc20Permit: dummyErc20Permit(bidder),
    ...overrides,
  }
}

async function createStandingBid(overrides: Record<string, unknown> = {}, authHeader = BIDDER_AUTH) {
  const res = await fetch(`${API_BASE}/bids/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(standingBidBody(overrides)),
  })
  return { status: res.status, body: await res.json() as any }
}

async function seedNft(metadata: Record<string, string>, tokenId: string) {
  const res = await fetch(`${API_BASE}/nft/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: BIDDER, chainId: TEST_CHAIN_ID, metadata, tokenId }),
  })
  if (res.status === 200 || res.status === 201) {
    return await res.json() as { id: string; tokenId: string }
  }
  return null
}

function auctionBody(nftId: string, overrides: Record<string, unknown> = {}) {
  const tokenId = String(9000000 + Math.floor(Math.random() * 100000))
  return {
    title: 'Standing bid test auction',
    nftContract: '0x' + '55'.repeat(20),
    nftTokenId: tokenId,
    chainId: TEST_CHAIN_ID,
    tokenContract: '0x' + '66'.repeat(20),
    startingBid: '1',
    endTime: futureDeadline(),
    auctioneer: AUCTIONEER,
    salt: '0x' + '77'.repeat(4),
    signature: '0x' + '88'.repeat(65),
    nftPermit: {
      owner: AUCTIONEER,
      spender: '0x' + '99'.repeat(20),
      tokenId,
      amount: '1',
      deadline: String(futureDeadline()),
      salt: '0x' + 'aa'.repeat(4),
    },
    nftPermitSignature: '0x' + 'bb'.repeat(65),
    nftId,
    ...overrides,
  }
}

async function createAuctionFixture(nftId: string, overrides: Record<string, unknown> = {}) {
  const res = await fetch(`${API_BASE}/auction/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUCTIONEER_AUTH },
    body: JSON.stringify(auctionBody(nftId, overrides)),
  })
  return { status: res.status, body: await res.json() as any }
}

describe('bids routes (standing buy orders)', () => {

  describe('POST / - validation', () => {
    test('rejects missing required fields', async () => {
      const { status, body } = await createStandingBid({ desiredTraits: undefined })
      assert.equal(status, 400)
      assert.match(body.error, /Missing required fields/)
    })

    test('rejects unauthenticated request', async () => {
      const res = await fetch(`${API_BASE}/bids/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(standingBidBody()),
      })
      assert.equal(res.status, 401)
    })

    test('rejects bidder mismatched with session address', async () => {
      const { status, body } = await createStandingBid({ bidder: AUCTIONEER })
      assert.equal(status, 403)
      assert.match(body.error, /Bidder must match/)
    })

    test('rejects invalid bidder address', async () => {
      const { status, body } = await createStandingBid({ bidder: 'not-an-address' })
      assert.equal(status, 400)
      assert.match(body.error, /Invalid bidder address/)
    })

    test('rejects targetMinHash with wrong band count', async () => {
      const { status, body } = await createStandingBid({ targetMinHash: ['0x1'] })
      assert.equal(status, 400)
      assert.match(body.error, new RegExp(`${MINHASH_BANDS} bands`))
    })

    test('rejects minMatches below 2', async () => {
      const { status, body } = await createStandingBid({ minMatches: 1 })
      assert.equal(status, 400)
      assert.match(body.error, /minMatches must be between/)
    })

    test('rejects minMatches above MINHASH_BANDS', async () => {
      const { status, body } = await createStandingBid({ minMatches: MINHASH_BANDS + 1 })
      assert.equal(status, 400)
      assert.match(body.error, /minMatches must be between/)
    })

    test('rejects a deadline in the past', async () => {
      const { status, body } = await createStandingBid({ deadline: Math.floor(Date.now() / 1000) - 60 })
      assert.equal(status, 400)
      assert.match(body.error, /Deadline must be in the future/)
    })
  })

  describe('create, list, cancel', () => {
    let createdId: string

    test('creates a standing bid', async () => {
      const { status, body } = await createStandingBid()
      assert.equal(status, 200)
      assert.equal(body.bid.bidder, BIDDER.toLowerCase())
      assert.equal(body.bid.status, 'active')
      assert.equal(body.bid.targetMinHash.length, MINHASH_BANDS)
      createdId = body.bid.id
    })

    test('lists standing bids filtered by bidder, defaults to active', async () => {
      const res = await fetch(`${API_BASE}/bids/?bidder=${BIDDER}`)
      const body = await res.json() as any
      assert.equal(res.status, 200)
      assert.ok(body.bids.some((b: any) => b.id === createdId))
      assert.ok(body.bids.every((b: any) => b.status === 'active'))
      assert.ok(body.bids.every((b: any) => b.bidder === BIDDER.toLowerCase()))
    })

    test('rejects cancellation from a non-owner', async () => {
      const res = await fetch(`${API_BASE}/bids/${createdId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${testToken(AUCTIONEER)}` },
      })
      assert.equal(res.status, 403)
    })

    test('404s cancelling a bid that does not exist', async () => {
      const res = await fetch(`${API_BASE}/bids/00000000-0000-0000-0000-000000000000`, {
        method: 'DELETE',
        headers: BIDDER_AUTH,
      })
      assert.equal(res.status, 404)
    })

    test('owner cancels the standing bid', async () => {
      const res = await fetch(`${API_BASE}/bids/${createdId}`, {
        method: 'DELETE',
        headers: BIDDER_AUTH,
      })
      assert.equal(res.status, 200)

      const listRes = await fetch(`${API_BASE}/bids/?bidder=${BIDDER}&status=cancelled`)
      const listBody = await listRes.json() as any
      assert.ok(listBody.bids.some((b: any) => b.id === createdId))
    })

    test('rejects cancelling an already-cancelled bid', async () => {
      const res = await fetch(`${API_BASE}/bids/${createdId}`, {
        method: 'DELETE',
        headers: BIDDER_AUTH,
      })
      assert.equal(res.status, 400)
    })
  })

  describe('GET /matching/:nftId', () => {
    let nft: { id: string; tokenId: string } | null = null
    const nftTraits = { rarity: 'legendary', material: 'orichalcum', age: 'bronze age' }
    let nftMinHash: string[]

    before(async () => {
      const baseId = 9100000 + Math.floor(Math.random() * 100000)
      nft = await seedNft(nftTraits, String(baseId))
      nftMinHash = computeMinHash(nftTraits)
    })

    test('returns bids that clear their own minMatches threshold', async () => {
      if (!nft) return
      const { status, body: created } = await createStandingBid({
        targetMinHash: nftMinHash,
        minMatches: MINHASH_BANDS, // identical traits -> identical minHash -> full match
      })
      assert.equal(status, 200)

      const res = await fetch(`${API_BASE}/bids/matching/${nft.id}`)
      const body = await res.json() as any
      assert.equal(res.status, 200)
      assert.ok(body.matchingBids.some((b: any) => b.id === created.bid.id))
    })

    test('excludes bids whose minMatches is not cleared', async () => {
      if (!nft) return
      // Deliberately unrelated traits - compute the real match count against
      // the seeded NFT rather than assuming 0, since MinHash band overlap
      // for dissimilar inputs isn't guaranteed to be zero.
      const differentTraits = { rarity: 'common', material: 'tin', age: 'stone age' }
      const differentMinHash = computeMinHash(differentTraits)
      const actualMatches = countMinHashMatches(differentMinHash, nftMinHash)
      const impossibleThreshold = Math.min(MINHASH_BANDS, actualMatches + 1)

      const { status, body: created } = await createStandingBid({
        targetMinHash: differentMinHash,
        minMatches: Math.max(2, impossibleThreshold),
      })
      assert.equal(status, 200)

      const res = await fetch(`${API_BASE}/bids/matching/${nft.id}`)
      const body = await res.json() as any
      assert.ok(!body.matchingBids.some((b: any) => b.id === created.bid.id))
    })

    test('404s for an NFT that does not exist', async () => {
      const res = await fetch(`${API_BASE}/bids/matching/00000000-0000-0000-0000-000000000000`)
      assert.equal(res.status, 404)
    })
  })

  describe('auto-attach on auction creation', () => {
    test('a matching standing bid is attached to a newly created auction', async () => {
      const traits = { rarity: 'epic', material: 'silver', age: 'iron age' }
      const nftMinHash = computeMinHash(traits)
      const baseId = 9200000 + Math.floor(Math.random() * 100000)
      const nft = await seedNft(traits, String(baseId))
      if (!nft) return

      const { status: bidStatus, body: created } = await createStandingBid({
        targetMinHash: nftMinHash,
        minMatches: MINHASH_BANDS,
        amount: '2000000000000000000', // 2 ETH-equivalent, comfortably above startingBid: '1'
      })
      assert.equal(bidStatus, 200)

      const { status: auctionStatus, body: auctionResult } = await createAuctionFixture(nft.id)
      assert.equal(auctionStatus, 200)
      // Not a strict equality: other suites in this file run concurrently
      // and share the same chainId's standing_bids table, so an unrelated
      // bid could coincidentally also clear threshold against this NFT.
      // What matters here is that *our* bid specifically got attached,
      // checked below via its own status.
      assert.ok(auctionResult.attachedBids >= 1)

      // The standing bid should have flipped to 'matched' and point at the
      // new auction.
      const listRes = await fetch(`${API_BASE}/bids/?bidder=${BIDDER}&status=matched`)
      const listBody = await listRes.json() as any
      const matched = listBody.bids.find((b: any) => b.id === created.bid.id)
      assert.ok(matched, 'standing bid should appear in matched list')
      assert.equal(matched.matchedAuctionId, auctionResult.auction.id)

      // And a real bid should now exist on the auction (highestBid reflects
      // the attached standing bid's amount).
      const auctionRes = await fetch(`${API_BASE}/auction/${auctionResult.auction.id}`)
      const auctionDetail = await auctionRes.json() as any
      assert.equal(auctionDetail.highestBid, created.bid.amount)
    })

    test('a non-matching standing bid is left active', async () => {
      const nftTraits = { rarity: 'mythic', material: 'obsidian', age: 'stone age' }
      const nftMinHash = computeMinHash(nftTraits)
      const bidTraits = { rarity: 'common', material: 'clay', age: 'modern' }
      const bidMinHash = computeMinHash(bidTraits)
      const actualMatches = countMinHashMatches(bidMinHash, nftMinHash)
      const impossibleThreshold = Math.max(2, Math.min(MINHASH_BANDS, actualMatches + 1))

      const baseId = 9300000 + Math.floor(Math.random() * 100000)
      const nft = await seedNft(nftTraits, String(baseId))
      if (!nft) return

      const { body: created } = await createStandingBid({
        targetMinHash: bidMinHash,
        minMatches: impossibleThreshold,
      })

      // Not asserting on the aggregate attachedBids count here - see the
      // comment in the previous test for why. What matters is whether our
      // specific bid (which cannot clear its own threshold against this
      // NFT) stays active.
      await createAuctionFixture(nft.id)

      const listRes = await fetch(`${API_BASE}/bids/?bidder=${BIDDER}&status=active`)
      const listBody = await listRes.json() as any
      assert.ok(listBody.bids.some((b: any) => b.id === created.bid.id))
    })
  })

  describe('POST /attach/:auctionId', () => {
    test('404s for an auction that does not exist', async () => {
      const res = await fetch(`${API_BASE}/bids/attach/00000000-0000-0000-0000-000000000000`, {
        method: 'POST',
      })
      assert.equal(res.status, 404)
    })

    // Regression test for the route's own copy of the match/attach loop
    // (distinct from attachStandingBids, which the auction-creation path
    // above exercises): a standing bid whose MinHash matches but whose
    // amount is below the auction's startingBid must fail placeBid's
    // validation and must NOT be marked 'matched' as a result. The lib
    // version (attachStandingBids) checks placeBid's returned
    // `{success: false}` and skips marking the bid; this route's inline
    // copy previously ignored that result entirely.
    test('does not mark a standing bid matched when placeBid rejects it', async () => {
      const traits = { rarity: 'rare', material: 'copper', age: 'bronze age' }
      const nftMinHash = computeMinHash(traits)
      const baseId = 9400000 + Math.floor(Math.random() * 100000)
      const nft = await seedNft(traits, String(baseId))
      if (!nft) return

      // Create the auction first, with a high starting bid, and with no
      // standing bids yet in existence - so auto-attach-on-create has
      // nothing to attach, and only the manual /attach/:auctionId call
      // below exercises the route's matching logic.
      const { body: auctionResult } = await createAuctionFixture(nft.id, {
        startingBid: '5000000000000000000', // 5 ETH-equivalent
      })

      const { body: created } = await createStandingBid({
        targetMinHash: nftMinHash,
        minMatches: MINHASH_BANDS,
        amount: '1', // clears MinHash matching but far below startingBid
      })

      const res = await fetch(`${API_BASE}/bids/attach/${auctionResult.auction.id}`, { method: 'POST' })
      const body = await res.json() as any
      assert.equal(res.status, 200)
      assert.ok(
        !body.attachedBidIds?.includes(created.bid.id),
        'placeBid should reject the under-starting-bid amount, so this bid must not be reported as attached'
      )

      const listRes = await fetch(`${API_BASE}/bids/?bidder=${BIDDER}&status=active`)
      const listBody = await listRes.json() as any
      assert.ok(
        listBody.bids.some((b: any) => b.id === created.bid.id),
        'standing bid should remain active, not be incorrectly marked matched'
      )
    })
  })

  describe('POST /:id/feedback', () => {
    async function createMatchedStandingBid() {
      const traits = { rarity: 'legendary', material: 'gold', age: 'medieval era' }
      const nftMinHash = computeMinHash(traits)
      const baseId = 9500000 + Math.floor(Math.random() * 100000)
      const nft = await seedNft(traits, String(baseId))
      if (!nft) return null

      const { body: created } = await createStandingBid({
        targetMinHash: nftMinHash,
        minMatches: MINHASH_BANDS,
        amount: '2000000000000000000',
      })
      const { body: auctionResult } = await createAuctionFixture(nft.id)
      return { standingBidId: created.bid.id as string, auctionId: auctionResult.auction.id as string }
    }

    test('rejects unauthenticated request', async () => {
      const res = await fetch(`${API_BASE}/bids/00000000-0000-0000-0000-000000000000/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId: 'x', reaction: 'good' }),
      })
      assert.equal(res.status, 401)
    })

    test('rejects a missing/invalid reaction', async () => {
      const matched = await createMatchedStandingBid()
      if (!matched) return
      const res = await fetch(`${API_BASE}/bids/${matched.standingBidId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...BIDDER_AUTH },
        body: JSON.stringify({ auctionId: matched.auctionId, reaction: 'great' }),
      })
      assert.equal(res.status, 400)
    })

    test('404s for a standing bid that does not exist', async () => {
      const res = await fetch(`${API_BASE}/bids/00000000-0000-0000-0000-000000000000/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...BIDDER_AUTH },
        body: JSON.stringify({ auctionId: 'x', reaction: 'good' }),
      })
      assert.equal(res.status, 404)
    })

    test('rejects feedback from a wallet other than the standing bid owner', async () => {
      const matched = await createMatchedStandingBid()
      if (!matched) return
      const res = await fetch(`${API_BASE}/bids/${matched.standingBidId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUCTIONEER_AUTH },
        body: JSON.stringify({ auctionId: matched.auctionId, reaction: 'good' }),
      })
      assert.equal(res.status, 403)
    })

    test('owner records good/bad reactions on their own matched standing bid', async () => {
      const matched = await createMatchedStandingBid()
      if (!matched) return

      const goodRes = await fetch(`${API_BASE}/bids/${matched.standingBidId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...BIDDER_AUTH },
        body: JSON.stringify({ auctionId: matched.auctionId, reaction: 'good' }),
      })
      const goodBody = await goodRes.json() as any
      assert.equal(goodRes.status, 200)
      assert.equal(goodBody.feedback.reaction, 'good')
      assert.equal(goodBody.feedback.standingBidId, matched.standingBidId)
      assert.equal(goodBody.feedback.bidder, BIDDER.toLowerCase())

      // A second reaction on the same match is allowed - pure signal
      // collection, not a one-shot vote.
      const badRes = await fetch(`${API_BASE}/bids/${matched.standingBidId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...BIDDER_AUTH },
        body: JSON.stringify({ auctionId: matched.auctionId, reaction: 'bad' }),
      })
      assert.equal(badRes.status, 200)
    })
  })
})
