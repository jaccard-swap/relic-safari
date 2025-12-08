import { auctions, bids, nfts, auctionEvents } from '@shared/database'
import { eq, desc, and, gte } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { CreateAuctionBody, PlaceBidBody } from './types'
import { broadcastEvent } from './rooms'

type DB = NodePgDatabase<any>

// Event types for the append-only log
export type AuctionEventType = 'created' | 'bid' | 'chat' | 'settled' | 'cancelled'

export interface EventSummary {
  amount?: string
  message?: string
  txHash?: string
  winner?: string
}

// Append event to auction log (and broadcast via websocket)
export async function appendEvent(
  db: DB,
  auctionId: string,
  type: AuctionEventType,
  actor: string,
  summary?: EventSummary,
  refId?: string
) {
  try {
    const [event] = await db
      .insert(auctionEvents)
      .values({
        auctionId,
        type,
        actor: actor.toLowerCase(),
        summary: summary || {},
        refId,
      })
      .returning()

    // Broadcast to room
    broadcastEvent(auctionId, event)

    return event
  } catch (err) {
    // Log but don't fail - table might not exist yet
    console.error('Failed to append event (table may not exist):', err)
    return null
  }
}

// Validation helpers
export const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i

export function isValidAddress(addr: string): boolean {
  return ADDRESS_REGEX.test(addr)
}

// ============ Auction Operations ============

export async function createAuction(db: DB, body: CreateAuctionBody) {
  const [auction] = await db
    .insert(auctions)
    .values({
      title: body.title,
      description: body.description,
      nftId: body.nftId,
      nftContract: body.nftContract.toLowerCase(),
      nftTokenId: body.nftTokenId,
      chainId: body.chainId,
      tokenContract: body.tokenContract.toLowerCase(),
      startingBid: body.startingBid,
      endTime: new Date(body.endTime * 1000),
      auctioneer: body.auctioneer.toLowerCase(),
      salt: body.salt,
      signature: body.signature,
      auctioneerNonce: body.auctioneerNonce,
      nftPermit: body.nftPermit,
      nftPermitSignature: body.nftPermitSignature,
      status: 'active',
    })
    .returning()

  // Append 'created' event
  await appendEvent(db, auction.id, 'created', body.auctioneer, {
    message: body.title,
  })

  return auction
}

export async function getAuction(db: DB, id: string) {
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, id))
    .limit(1)

  return auction
}

export async function getAuctionWithDetails(db: DB, id: string) {
  const auction = await getAuction(db, id)
  if (!auction) return null

  // Get events from append-only log (ordered by time)
  const events = await db
    .select()
    .from(auctionEvents)
    .where(eq(auctionEvents.auctionId, id))
    .orderBy(auctionEvents.createdAt)

  // Get highest bid for display
  const [highestBid] = await db
    .select()
    .from(bids)
    .where(and(eq(bids.auctionId, id), eq(bids.status, 'active')))
    .orderBy(desc(bids.amount))
    .limit(1)

  let nft = null
  if (auction.nftId) {
    const [nftResult] = await db
      .select()
      .from(nfts)
      .where(eq(nfts.id, auction.nftId))
      .limit(1)
    nft = nftResult
  }

  return { auction, events, highestBid: highestBid?.amount, nft }
}

export interface ListAuctionsFilters {
  chainId?: number
  status?: string
}

export async function listAuctions(db: DB, filters: ListAuctionsFilters = {}) {
  const now = new Date()
  const conditions = []

  if (filters.status) {
    conditions.push(eq(auctions.status, filters.status))
  } else {
    conditions.push(eq(auctions.status, 'active'))
    conditions.push(gte(auctions.endTime, now))
  }

  if (filters.chainId) {
    conditions.push(eq(auctions.chainId, filters.chainId))
  }

  const results = await db
    .select()
    .from(auctions)
    .where(and(...conditions))
    .orderBy(desc(auctions.createdAt))

  return results
}

export async function getAuctionsByAuctioneer(db: DB, address: string) {
  const results = await db
    .select()
    .from(auctions)
    .where(eq(auctions.auctioneer, address.toLowerCase()))
    .orderBy(desc(auctions.createdAt))

  return results
}

// ============ Bid Operations ============

export interface PlaceBidResult {
  success: boolean
  bid?: any
  previousHighest?: string
  error?: string
}

export async function placeBid(db: DB, auctionId: string, body: PlaceBidBody, opts?: { skipHighestCheck?: boolean }): Promise<PlaceBidResult> {
  // Get auction
  const auction = await getAuction(db, auctionId)
  if (!auction) {
    return { success: false, error: 'Auction not found' }
  }

  if (auction.status !== 'active') {
    return { success: false, error: 'Auction is not active' }
  }

  if (new Date() >= auction.endTime) {
    return { success: false, error: 'Auction has ended' }
  }

  const bidAmount = BigInt(body.amount)
  const startingBid = BigInt(auction.startingBid)

  if (bidAmount < startingBid) {
    return { success: false, error: 'Bid must be at least the starting bid' }
  }

  // Check highest bid
  const [highestBid] = await db
    .select()
    .from(bids)
    .where(and(eq(bids.auctionId, auctionId), eq(bids.status, 'active')))
    .orderBy(desc(bids.amount))
    .limit(1)

  // Skip highest check for standing bids (they all attach at once)
  if (!opts?.skipHighestCheck && highestBid && bidAmount <= BigInt(highestBid.amount)) {
    return { success: false, error: 'Bid must be higher than current highest bid' }
  }

  // Mark previous highest as outbid
  if (highestBid) {
    await db
      .update(bids)
      .set({ status: 'outbid' })
      .where(eq(bids.id, highestBid.id))
  }

  // Insert new bid
  const [bid] = await db
    .insert(bids)
    .values({
      auctionId,
      bidder: body.bidder.toLowerCase(),
      amount: body.amount,
      salt: body.salt,
      deadline: body.deadline ? new Date(body.deadline * 1000) : undefined,
      targetMinHash: body.targetMinHash,
      minMatches: body.minMatches,
      erc20Permit: body.erc20Permit,
      signature: body.signature,
      bidSigHash: body.bidSigHash,
      bidderNonce: body.bidderNonce,
      status: 'active',
    })
    .returning()

  // Append 'bid' event (broadcasts to room)
  await appendEvent(db, auctionId, 'bid', body.bidder, { amount: body.amount }, bid.id)

  return { success: true, bid, previousHighest: highestBid?.amount }
}

export interface CancelAuctionResult {
  success: boolean
  error?: string
}

export async function cancelAuction(db: DB, auctionId: string, auctioneer: string): Promise<CancelAuctionResult> {
  const auction = await getAuction(db, auctionId)
  if (!auction) {
    return { success: false, error: 'Auction not found' }
  }

  if (auction.auctioneer !== auctioneer.toLowerCase()) {
    return { success: false, error: 'Only auctioneer can cancel' }
  }

  // Check for existing bids
  const [existingBid] = await db
    .select()
    .from(bids)
    .where(eq(bids.auctionId, auctionId))
    .limit(1)

  if (existingBid) {
    return { success: false, error: 'Cannot cancel auction with bids' }
  }

  await db
    .update(auctions)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(auctions.id, auctionId))

  // Append 'cancelled' event (broadcasts to room)
  await appendEvent(db, auctionId, 'cancelled', auctioneer)

  return { success: true }
}

// ============ Consume Auction ============

export interface ConsumeAuctionResult {
  success: boolean
  error?: string
  auction?: any
  bids?: any[]
  nft?: any
}

export async function getAuctionForConsume(db: DB, auctionId: string, auctioneer: string): Promise<ConsumeAuctionResult> {
  // TODO: Add preflight checks:
  // - Verify NFT still exists and is owned by auctioneer
  // - Verify NFT permit signature is valid
  // - Verify all bid signatures are valid
  // - Verify bidders have sufficient token balance and allowance
  
  const auction = await getAuction(db, auctionId)
  if (!auction) {
    return { success: false, error: 'Auction not found' }
  }

  if (auction.auctioneer !== auctioneer.toLowerCase()) {
    return { success: false, error: 'Only auctioneer can consume auction' }
  }

  if (auction.status !== 'active') {
    return { success: false, error: 'Auction is not active' }
  }

  // Get all bids ordered by amount descending (highest first)
  const auctionBids = await db
    .select()
    .from(bids)
    .where(eq(bids.auctionId, auctionId))
    .orderBy(desc(bids.amount))

  // Get NFT info if linked
  let nft = null
  if (auction.nftId) {
    const [nftResult] = await db
      .select()
      .from(nfts)
      .where(eq(nfts.id, auction.nftId))
      .limit(1)
    nft = nftResult
  }

  return {
    success: true,
    auction,
    bids: auctionBids,
    nft,
  }
}

// Settle auction result
export interface SettleAuctionResult {
  success: boolean
  error?: string
  auction?: typeof auctions.$inferSelect
}

// Settle an auction (mark as settled with tx hash)
export async function settleAuction(
  db: NodePgDatabase<any>,
  auctionId: string,
  auctioneer: string,
  txHash: string,
  winner?: string,
  winningBid?: string
): Promise<SettleAuctionResult> {
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1)

  if (!auction) {
    return { success: false, error: 'Auction not found' }
  }

  if (auction.auctioneer.toLowerCase() !== auctioneer.toLowerCase()) {
    return { success: false, error: 'Only auctioneer can settle' }
  }

  if (auction.status === 'settled') {
    return { success: false, error: 'Auction already settled' }
  }

  const [updated] = await db
    .update(auctions)
    .set({
      status: 'settled',
      settlementTxHash: txHash,
      winner: winner || null,
      winningBid: winningBid || null,
      updatedAt: new Date(),
    })
    .where(eq(auctions.id, auctionId))
    .returning()

  // Append 'settled' event (broadcasts to room)
  await appendEvent(db, auctionId, 'settled', auctioneer, {
    txHash,
    winner,
    amount: winningBid,
  })

  return { success: true, auction: updated }
}

