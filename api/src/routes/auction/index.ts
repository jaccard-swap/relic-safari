import { FastifyPluginAsync } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import type { FastifyRequest } from 'fastify'
import {
  // Types
  MSG,
  type CreateAuctionBody,
  type PlaceBidBody,
  type SettleAuctionBody,
  // Room management
  getRoom,
  deleteRoom,
  broadcastToRoom,
  subscribeFeed,
  unsubscribeFeed,
  getFeedSize,
  broadcastNewAuction,
  // Message handlers
  handlePing,
  handleJoin,
  handleChat,
  // Database operations
  isValidAddress,
  createAuction,
  getAuctionWithDetails,
  listAuctions,
  getAuctionsByAuctioneer,
  placeBid,
  cancelAuction,
  getAuctionForConsume,
  settleAuction,
} from '../../lib/Auction'

// ============ Routes ============

const auctionRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {

  // WebSocket: Auction room at /:id/room
  fastify.route({
    method: 'GET',
    url: '/:id/room',
    handler: () => {
      // Non-websocket requests - wsHandler takes over for upgrades
    },
    // @ts-expect-error - wsHandler is added by @fastify/websocket plugin
    wsHandler: (socket: WebSocket, req: FastifyRequest) => {
      const { id: auctionId } = req.params as { id: string }
      const room = getRoom(auctionId)

      room.set(socket, { joinedAt: Date.now() })
      fastify.log.info({ auctionId, clients: room.size }, 'Client joined auction room')

      broadcastToRoom(auctionId, { type: MSG.JOINED, count: room.size, timestamp: Date.now() }, socket)
      socket.send(JSON.stringify({ type: MSG.JOINED, auctionId, count: room.size, timestamp: Date.now() }))

      socket.on('message', (raw: Buffer) => {
        try {
          const message = JSON.parse(raw.toString())
          const clientInfo = room.get(socket)
          fastify.log.info({ auctionId, type: message.type, clientAddress: clientInfo?.address }, '📨 WS message received')

          const ctx = { auctionId, socket, room, clientInfo, db: fastify.db, log: fastify.log }

          switch (message.type) {
            case MSG.PING:
              handlePing(ctx)
              break
            case MSG.JOIN:
              handleJoin(ctx, message.address)
              break
            case MSG.CHAT:
              handleChat(ctx, message.message)
              break
            default:
              fastify.log.warn({ auctionId, type: message.type }, 'Unknown message type')
          }
        } catch (err) {
          fastify.log.error({ err }, 'Failed to parse WS message')
          socket.send(JSON.stringify({ type: MSG.ERROR, error: 'Invalid JSON' }))
        }
      })

      socket.on('close', () => {
        const clientInfo = room.get(socket)
        room.delete(socket)
        fastify.log.info({ auctionId, clients: room.size }, 'Client left auction room')

        if (room.size === 0) {
          deleteRoom(auctionId)
        } else {
          broadcastToRoom(auctionId, { type: MSG.LEFT, address: clientInfo?.address, count: room.size, timestamp: Date.now() })
        }
      })

      socket.on('error', (error: Error) => {
        fastify.log.error({ error, auctionId }, 'WebSocket error')
      })
    }
  })

  // WebSocket: Global auction feed (for new auction notifications)
  fastify.route({
    method: 'GET',
    url: '/feed',
    handler: () => {
      // Non-websocket requests - wsHandler takes over for upgrades
    },
    // @ts-expect-error - wsHandler is added by @fastify/websocket plugin
    wsHandler: async (socket: WebSocket) => {
      subscribeFeed(socket)
      fastify.log.info({ subscribers: getFeedSize() }, 'Client joined auction feed')

      // Send current active auctions on connect
      try {
        const activeAuctions = await listAuctions(fastify.db, { status: 'active' })
        socket.send(JSON.stringify({ 
          type: MSG.AUCTIONS_LIST, 
          auctions: activeAuctions,
          timestamp: Date.now() 
        }))
      } catch (err) {
        fastify.log.error({ err }, 'Failed to send initial auctions')
      }

      socket.on('message', (raw: Buffer) => {
        try {
          const message = JSON.parse(raw.toString())
          if (message.type === MSG.PING) {
            socket.send(JSON.stringify({ type: MSG.PONG, timestamp: Date.now() }))
          }
        } catch (err) {
          fastify.log.error({ err }, 'Failed to parse feed message')
        }
      })

      socket.on('close', () => {
        unsubscribeFeed(socket)
        fastify.log.info({ subscribers: getFeedSize() }, 'Client left auction feed')
      })

      socket.on('error', (error: Error) => {
        fastify.log.error({ error }, 'Feed WebSocket error')
      })
    }
  })

  // REST: Create auction
  fastify.post('/', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const body = request.body as CreateAuctionBody
    const sessionAddress = request.session!.address.toLowerCase()

    // Validate basic required fields
    if (!body.title || !body.nftContract || !body.nftTokenId || !body.tokenContract || !body.startingBid || !body.endTime || !body.auctioneer) {
      reply.code(400)
      return { error: 'Missing required fields: title, nftContract, nftTokenId, tokenContract, startingBid, endTime, auctioneer' }
    }

    // Ensure authenticated user matches auctioneer
    if (body.auctioneer.toLowerCase() !== sessionAddress) {
      reply.code(403)
      return { error: 'Auctioneer must match authenticated address' }
    }

    // Validate EIP-712 signature data (required for on-chain settlement)
    if (!body.salt || !body.signature) {
      reply.code(400)
      return { error: 'Missing required signature data: salt, signature' }
    }

    // Validate NFT permit data (required for on-chain NFT transfer)
    if (!body.nftPermit || !body.nftPermitSignature) {
      reply.code(400)
      return { error: 'Missing required NFT permit data: nftPermit, nftPermitSignature' }
    }

    if (!body.nftPermit.owner || !body.nftPermit.spender || !body.nftPermit.tokenId || !body.nftPermit.amount || !body.nftPermit.deadline || !body.nftPermit.salt) {
      reply.code(400)
      return { error: 'Invalid nftPermit: requires owner, spender, tokenId, amount, deadline, salt' }
    }

    if (!isValidAddress(body.nftContract) || !isValidAddress(body.tokenContract) || !isValidAddress(body.auctioneer)) {
      reply.code(400)
      return { error: 'Invalid address format' }
    }

    if (body.endTime <= Math.floor(Date.now() / 1000)) {
      reply.code(400)
      return { error: 'End time must be in the future' }
    }

    try {
      const auction = await createAuction(fastify.db, body)
      fastify.log.info({ auctionId: auction.id, auctioneer: body.auctioneer }, 'Auction created')
      
      // Auto-attach matching standing bids
      let attachedBids = 0
      if (auction.nftId) {
        try {
          const { attachStandingBids } = await import('../../lib/Auction/standingBids.js')
          const attached = await attachStandingBids(fastify.db, fastify.log, auction.id)
          attachedBids = attached.length
          if (attachedBids > 0) {
            fastify.log.info({ auctionId: auction.id, attachedBids }, 'Standing bids attached to auction')
          }
        } catch (err) {
          fastify.log.warn({ err, auctionId: auction.id }, 'Failed to attach standing bids (non-fatal)')
        }
      }
      
      // Broadcast to feed subscribers
      broadcastNewAuction(auction)
      
      return { auction, attachedBids }
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create auction')
      reply.code(500)
      return { error: 'Failed to create auction' }
    }
  })

  // REST: List auctions
  fastify.get('/', async function (request, reply) {
    const { chainId, status } = request.query as { chainId?: string; status?: string }

    try {
      const results = await listAuctions(fastify.db, {
        chainId: chainId ? parseInt(chainId) : undefined,
        status,
      })
      return { auctions: results, count: results.length }
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch auctions')
      reply.code(500)
      return { error: 'Failed to fetch auctions' }
    }
  })

  // REST: Get auctions by auctioneer
  fastify.get('/by-auctioneer/:address', async function (request, reply) {
    const { address } = request.params as { address: string }

    if (!address || !isValidAddress(address)) {
      reply.code(400)
      return { error: 'Invalid address' }
    }

    try {
      const results = await getAuctionsByAuctioneer(fastify.db, address)
      return { auctions: results, count: results.length }
    } catch (error) {
      fastify.log.error({ error, address }, 'Failed to fetch auctions by auctioneer')
      reply.code(500)
      return { error: 'Failed to fetch auctions' }
    }
  })

  // REST: Get single auction with bids
  fastify.get('/:id', async function (request, reply) {
    const { id } = request.params as { id: string }

    try {
      const result = await getAuctionWithDetails(fastify.db, id)
      if (!result) {
        reply.code(404)
        return { error: 'Auction not found' }
      }
      return result
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to fetch auction')
      reply.code(500)
      return { error: 'Failed to fetch auction' }
    }
  })

  // REST: Place bid
  fastify.post('/:id/bid', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { id } = request.params as { id: string }
    const body = request.body as PlaceBidBody
    const sessionAddress = request.session!.address.toLowerCase()

    if (!body.bidder || !body.amount) {
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

    try {
      const result = await placeBid(fastify.db, id, body)
      
      if (!result.success) {
        reply.code(400)
        return { error: result.error }
      }

      fastify.log.info({ auctionId: id, bidder: body.bidder, amount: body.amount }, 'Bid placed')
      return { bid: result.bid, previousHighest: result.previousHighest }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to place bid')
      reply.code(500)
      return { error: 'Failed to place bid' }
    }
  })

  // REST: Check and attach matching standing bids
  fastify.post('/:id/check-bids', async function (request, reply) {
    const { id } = request.params as { id: string }

    try {
      const { attachStandingBids, getLastBidCheck, updateLastBidCheck } = await import('../../lib/Auction/standingBids.js')
      
      // Get auction to check if it exists and get lastBidCheck
      const lastCheck = await getLastBidCheck(fastify.db, id)
      
      if (lastCheck === null) {
        reply.code(404)
        return { error: 'Auction not found' }
      }

      // Only check if we haven't checked in the last 30 seconds
      const now = new Date()
      const minInterval = 30 * 1000 // 30 seconds
      if (lastCheck && (now.getTime() - lastCheck.getTime()) < minInterval) {
        return { 
          matched: [], 
          skipped: true, 
          message: 'Recently checked, try again later' 
        }
      }

      // Attach matching standing bids (placeBid handles WS broadcast)
      const attached = await attachStandingBids(fastify.db, fastify.log, id)
      
      // Update last check time
      await updateLastBidCheck(fastify.db, id)
      
      if (attached.length > 0) {
        fastify.log.info({ auctionId: id, matched: attached.length }, 'Standing bids matched and attached')
      }

      return { 
        matched: attached, 
        count: attached.length,
        checkedAt: now.toISOString(),
      }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to check standing bids')
      reply.code(500)
      return { error: 'Failed to check standing bids' }
    }
  })

  // REST: Get auction data for consuming (settlement)
  fastify.get('/:id/consume', async function (request, reply) {
    const { id } = request.params as { id: string }
    const { auctioneer } = request.query as { auctioneer: string }

    if (!auctioneer || !isValidAddress(auctioneer)) {
      reply.code(400)
      return { error: 'Invalid auctioneer address' }
    }

    try {
      const result = await getAuctionForConsume(fastify.db, id, auctioneer)
      
      if (!result.success) {
        reply.code(400)
        return { error: result.error }
      }

      fastify.log.info({ auctionId: id, auctioneer, bidCount: result.bids?.length }, 'Auction consume data fetched')
      
      return {
        auction: result.auction,
        bids: result.bids,
        nft: result.nft,
      }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to fetch auction consume data')
      reply.code(500)
      return { error: 'Failed to fetch auction consume data' }
    }
  })

  // REST: Settle auction (mark as completed with tx hash)
  fastify.post('/:id/settle', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { id } = request.params as { id: string }
    const body = request.body as SettleAuctionBody
    const sessionAddress = request.session!.address.toLowerCase()

    if (!body.auctioneer || !body.txHash) {
      reply.code(400)
      return { error: 'Missing required fields: auctioneer, txHash' }
    }

    if (!isValidAddress(body.auctioneer)) {
      reply.code(400)
      return { error: 'Invalid auctioneer address' }
    }

    // Ensure authenticated user matches auctioneer
    if (body.auctioneer.toLowerCase() !== sessionAddress) {
      reply.code(403)
      return { error: 'Auctioneer must match authenticated address' }
    }

    try {
      const result = await settleAuction(
        fastify.db,
        id,
        body.auctioneer,
        body.txHash,
        body.winner,
        body.winningBid
      )
      
      if (!result.success) {
        reply.code(400)
        return { error: result.error }
      }

      fastify.log.info({ auctionId: id, txHash: body.txHash, winner: body.winner }, 'Auction settled')

      // Broadcast settlement to all connected clients
      broadcastToRoom(id, {
        type: MSG.SETTLED,
        auctionId: id,
        txHash: body.txHash,
        winner: body.winner,
        winningBid: body.winningBid,
        timestamp: Date.now(),
      })

      return { success: true, auction: result.auction }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to settle auction')
      reply.code(500)
      return { error: 'Failed to settle auction' }
    }
  })

  // REST: Cancel auction
  fastify.delete('/:id', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { id } = request.params as { id: string }
    const sessionAddress = request.session!.address.toLowerCase()
    // Use session address instead of query param
    const auctioneer = sessionAddress

    if (!auctioneer || !isValidAddress(auctioneer)) {
      reply.code(400)
      return { error: 'Invalid auctioneer address' }
    }

    try {
      const result = await cancelAuction(fastify.db, id, auctioneer)
      
      if (!result.success) {
        reply.code(400)
        return { error: result.error }
      }

      fastify.log.info({ auctionId: id, auctioneer }, 'Auction cancelled')
      return { success: true }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to cancel auction')
      reply.code(500)
      return { error: 'Failed to cancel auction' }
    }
  })
}

export default auctionRoutes
