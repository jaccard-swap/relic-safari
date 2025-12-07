import type { FastifyBaseLogger } from 'fastify'
import { eq, and, gt, desc } from 'drizzle-orm'
import * as dbSchema from '@shared/database'
import { countMinHashMatches } from '@shared/constants'
import { placeBid } from './db.js'

const { standingBids, nfts, auctions } = dbSchema

export interface AttachedBid {
  id: string
  bidder: string
  amount: string
  matches: number
}

/**
 * Find and attach matching standing bids to an auction
 * Called automatically when an auction is created
 */
export async function attachStandingBids(
  db: any,
  log: FastifyBaseLogger,
  auctionId: string
): Promise<AttachedBid[]> {
  // Get the auction
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1)

  if (!auction?.nftId) {
    log.debug({ auctionId }, 'attachStandingBids: No nftId on auction')
    return []
  }

  // Get the NFT
  const [nft] = await db
    .select()
    .from(nfts)
    .where(eq(nfts.id, auction.nftId))
    .limit(1)

  if (!nft) {
    log.debug({ auctionId, nftId: auction.nftId }, 'attachStandingBids: NFT not found')
    return []
  }

  const nftMinHash = nft.minHash as string[]
  
  log.info({ 
    auctionId, 
    nftId: nft.id,
    chainId: nft.chainId,
    nftMinHash: nftMinHash.map(h => h.slice(0, 10) + '...'),
  }, 'attachStandingBids: Checking for matching bids')

  // Get active standing bids for this chain
  const activeBids = await db
    .select()
    .from(standingBids)
    .where(and(
      eq(standingBids.status, 'active'),
      eq(standingBids.chainId, nft.chainId),
      gt(standingBids.deadline, new Date())
    ))
    .orderBy(desc(standingBids.amount))

  log.info({ 
    auctionId, 
    activeBidsCount: activeBids.length,
    chainId: nft.chainId,
  }, 'attachStandingBids: Found active standing bids')

  const attached: AttachedBid[] = []

  for (const standingBid of activeBids) {
    const bidMinHash = standingBid.targetMinHash as string[]
    const matches = countMinHashMatches(bidMinHash, nftMinHash)
    
    log.info({
      standingBidId: standingBid.id,
      bidder: standingBid.bidder,
      matches,
      minMatches: standingBid.minMatches,
      eligible: matches >= standingBid.minMatches,
    }, 'attachStandingBids: Evaluating standing bid')
    
    if (matches >= standingBid.minMatches) {
      try {
        // Create auction bid from standing bid
        const erc20Permit = standingBid.erc20Permit as {
          owner: string
          spender: string
          value: string
          deadline: number
          v: number
          r: string
          s: string
        }

        await placeBid(db, auctionId, {
          bidder: standingBid.bidder,
          amount: standingBid.amount,
          salt: standingBid.salt,
          deadline: Math.floor(standingBid.deadline.getTime() / 1000),
          targetMinHash: bidMinHash,
          minMatches: standingBid.minMatches,
          signature: standingBid.signature,
          erc20Permit: {
            ...erc20Permit,
            deadline: String(erc20Permit.deadline),
          },
        })

        // Mark standing bid as matched
        await db
          .update(standingBids)
          .set({ 
            status: 'matched',
            matchedAuctionId: auctionId,
            updatedAt: new Date(),
          })
          .where(eq(standingBids.id, standingBid.id))

        attached.push({
          id: standingBid.id,
          bidder: standingBid.bidder,
          amount: standingBid.amount,
          matches,
        })
        
        log.info({ 
          standingBidId: standingBid.id, 
          auctionId, 
          matches,
          minMatches: standingBid.minMatches,
          amount: standingBid.amount 
        }, 'Standing bid attached to auction')
      } catch (err) {
        log.warn({ err, standingBidId: standingBid.id }, 'Failed to attach standing bid')
      }
    }
  }

  return attached
}

/**
 * Get the last time standing bids were checked for an auction
 * Returns null if auction not found, Date if checked, or undefined if never checked
 */
export async function getLastBidCheck(db: any, auctionId: string): Promise<Date | null | undefined> {
  const [auction] = await db
    .select({ lastBidCheck: auctions.lastBidCheck })
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1)

  if (!auction) return null
  return auction.lastBidCheck || undefined
}

/**
 * Update the last bid check timestamp for an auction
 */
export async function updateLastBidCheck(db: any, auctionId: string): Promise<void> {
  await db
    .update(auctions)
    .set({ lastBidCheck: new Date() })
    .where(eq(auctions.id, auctionId))
}

