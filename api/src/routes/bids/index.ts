import { FastifyPluginAsync } from 'fastify'
import * as dbSchema from '@shared/database'
import { countMinHashMatches, MINHASH_BANDS } from '@shared/constants'
import { eq, and, gt, desc } from 'drizzle-orm'

const { standingBids, auctions, nfts } = dbSchema

// ============================================================================
// Types
// ============================================================================

interface CreateStandingBidBody {
  bidder: string
  chainId: number
  amount: string // wei
  targetMinHash: string[] // bytes8[20]
  minMatches: number // 2-20
  desiredTraits: Record<string, string> // { rarity: 'legendary', ... }
  salt: string // bytes4
  deadline: number // unix timestamp
  signature: string
  erc20Permit: {
    owner: string
    spender: string
    value: string
    deadline: number
    v: number
    r: string
    s: string
  }
}

// ============================================================================
// Helpers
// ============================================================================

function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/i.test(addr)
}

// ============================================================================
// Routes
// ============================================================================

const bidRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {

  // POST / - Create standing bid
  fastify.post('/', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const body = request.body as CreateStandingBidBody
    const sessionAddress = request.session!.address.toLowerCase()

    // Validate required fields
    if (!body.bidder || !body.chainId || !body.amount || !body.targetMinHash || 
        !body.minMatches || !body.desiredTraits || !body.salt || !body.deadline ||
        !body.signature || !body.erc20Permit) {
      reply.code(400)
      return { error: 'Missing required fields' }
    }

    if (!isValidAddress(body.bidder)) {
      reply.code(400)
      return { error: 'Invalid bidder address' }
    }

    // Ensure authenticated user matches bidder
    if (body.bidder.toLowerCase() !== sessionAddress) {
      reply.code(403)
      return { error: 'Bidder must match authenticated address' }
    }

    if (body.targetMinHash.length !== MINHASH_BANDS) {
      reply.code(400)
      return { error: `targetMinHash must have exactly ${MINHASH_BANDS} bands` }
    }

    if (body.minMatches < 2 || body.minMatches > MINHASH_BANDS) {
      reply.code(400)
      return { error: `minMatches must be between 2 and ${MINHASH_BANDS}` }
    }

    if (body.deadline <= Math.floor(Date.now() / 1000)) {
      reply.code(400)
      return { error: 'Deadline must be in the future' }
    }

    try {
      const [bid] = await fastify.db
        .insert(standingBids)
        .values({
          bidder: body.bidder.toLowerCase(),
          chainId: body.chainId,
          amount: body.amount,
          targetMinHash: body.targetMinHash,
          minMatches: body.minMatches,
          desiredTraits: body.desiredTraits,
          salt: body.salt,
          deadline: new Date(body.deadline * 1000),
          signature: body.signature,
          erc20Permit: body.erc20Permit,
          status: 'active',
        })
        .returning()

      fastify.log.info({ bidId: bid.id, bidder: body.bidder, amount: body.amount }, 'Standing bid created')
      
      return { bid }
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create standing bid')
      reply.code(500)
      return { error: 'Failed to create standing bid' }
    }
  })

  // GET / - List standing bids
  fastify.get('/', async function (request, reply) {
    const { bidder, chainId, status } = request.query as { 
      bidder?: string
      chainId?: string
      status?: string 
    }

    try {
      let query = fastify.db
        .select()
        .from(standingBids)
        .orderBy(desc(standingBids.createdAt))

      const results = await query

      // Filter in memory (simpler than building dynamic where clauses)
      let filtered = results
      if (bidder) {
        filtered = filtered.filter(b => b.bidder.toLowerCase() === bidder.toLowerCase())
      }
      if (chainId) {
        filtered = filtered.filter(b => b.chainId === parseInt(chainId))
      }
      if (status) {
        filtered = filtered.filter(b => b.status === status)
      } else {
        // Default to active bids only
        filtered = filtered.filter(b => b.status === 'active')
      }

      // Also filter out expired bids
      const now = new Date()
      filtered = filtered.filter(b => new Date(b.deadline) > now)

      return { 
        bids: filtered.map(b => ({
          ...b,
          deadline: b.deadline.toISOString(),
        })),
        count: filtered.length 
      }
    } catch (error) {
      fastify.log.error({ error }, 'Failed to list standing bids')
      reply.code(500)
      return { error: 'Failed to list standing bids' }
    }
  })

  // GET /matching/:nftId - Find bids matching an NFT's MinHash
  fastify.get('/matching/:nftId', async function (request, reply) {
    const { nftId } = request.params as { nftId: string }

    try {
      // Get the NFT
      const [nft] = await fastify.db
        .select()
        .from(nfts)
        .where(eq(nfts.id, nftId))
        .limit(1)

      if (!nft) {
        reply.code(404)
        return { error: 'NFT not found' }
      }

      const nftMinHash = nft.minHash as string[]

      // Get active standing bids for this chain
      const activeBids = await fastify.db
        .select()
        .from(standingBids)
        .where(and(
          eq(standingBids.status, 'active'),
          eq(standingBids.chainId, nft.chainId),
          gt(standingBids.deadline, new Date())
        ))
        .orderBy(desc(standingBids.amount))

      // Filter bids that meet their own minMatches threshold
      const matchingBids = activeBids.filter(bid => {
        const bidMinHash = bid.targetMinHash as string[]
        const matches = countMinHashMatches(bidMinHash, nftMinHash)
        return matches >= bid.minMatches
      }).map(bid => ({
        ...bid,
        deadline: bid.deadline.toISOString(),
        matchCount: countMinHashMatches(bid.targetMinHash as string[], nftMinHash),
      }))

      return { 
        nftId,
        nftMinHash,
        matchingBids,
        count: matchingBids.length 
      }
    } catch (error) {
      fastify.log.error({ error, nftId }, 'Failed to find matching bids')
      reply.code(500)
      return { error: 'Failed to find matching bids' }
    }
  })

  // POST /attach - Attach matching standing bids to an auction
  fastify.post('/attach/:auctionId', async function (request, reply) {
    const { auctionId } = request.params as { auctionId: string }

    try {
      const [auction] = await fastify.db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1)

      if (!auction) {
        reply.code(404)
        return { error: 'Auction not found' }
      }

      if (!auction.nftId) {
        reply.code(400)
        return { error: 'Auction has no linked NFT' }
      }

      // Delegates to the same matcher used on auction creation (see
      // lib/Auction/standingBids.ts) rather than reimplementing the
      // match/attach loop here - a prior duplicate copy ignored placeBid's
      // {success: false} result and could mark a standing bid 'matched'
      // even when the attach itself failed (e.g. amount below the
      // auction's startingBid).
      const { attachStandingBids } = await import('../../lib/Auction/standingBids.js')
      const attached = await attachStandingBids(fastify.db, fastify.log, auctionId)

      return {
        auctionId,
        attachedCount: attached.length,
        attachedBidIds: attached.map(a => a.id),
      }
    } catch (error) {
      fastify.log.error({ error, auctionId }, 'Failed to attach standing bids')
      reply.code(500)
      return { error: 'Failed to attach standing bids' }
    }
  })

  // DELETE /:id - Cancel standing bid
  fastify.delete('/:id', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { id } = request.params as { id: string }
    // Use session address instead of query param
    const bidder = request.session!.address.toLowerCase()

    if (!bidder || !isValidAddress(bidder)) {
      reply.code(400)
      return { error: 'Invalid bidder address' }
    }

    try {
      const [bid] = await fastify.db
        .select()
        .from(standingBids)
        .where(eq(standingBids.id, id))
        .limit(1)

      if (!bid) {
        reply.code(404)
        return { error: 'Standing bid not found' }
      }

      if (bid.bidder.toLowerCase() !== bidder.toLowerCase()) {
        reply.code(403)
        return { error: 'Not authorized to cancel this bid' }
      }

      if (bid.status !== 'active') {
        reply.code(400)
        return { error: `Cannot cancel bid with status: ${bid.status}` }
      }

      await fastify.db
        .update(standingBids)
        .set({ 
          status: 'cancelled',
          updatedAt: new Date(),
        })
        .where(eq(standingBids.id, id))

      fastify.log.info({ bidId: id, bidder }, 'Standing bid cancelled')
      return { success: true }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to cancel standing bid')
      reply.code(500)
      return { error: 'Failed to cancel standing bid' }
    }
  })
}

export default bidRoutes

