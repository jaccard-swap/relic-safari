import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import * as dbSchema from '@shared/database'
import { TRAIT_POOLS, WS_MSG, getCupboardKey, getCupboardWeight, getCupboardPoints } from '@shared/constants'
import { isFullyMaxed } from '../../lib/traitUpgrades'
import { joinRequestRoom, leaveRequestRoom, broadcastRequestStatus } from '../../lib/requestRooms'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { decodeEventLog, parseAbiItem, zeroAddress } from 'viem'
import type { SupportedChainId } from '../../plugins/web3'

const { nfts, cupboardCompletions } = dbSchema

const SITES = TRAIT_POOLS.site.values.map((v) => v.value)
const AGES = TRAIT_POOLS.age.values.map((v) => v.value)
const MATERIALS = TRAIT_POOLS.material.values.map((v) => v.value)
const FORMS = TRAIT_POOLS.form.values.map((v) => v.value)

const BADGE_TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)')

interface ProgressQuery {
  owner?: string
  chainId?: string
}

interface CompleteCupboardBody {
  owner: string
  chainId: number
  site: string
  age: string
  material: string
}

interface OwnerNftRow {
  id: string
  tokenId: string
  metadata: unknown
}

interface CupboardState {
  filledForms: Record<string, string | null>
  complete: boolean
  alreadyCompleted: boolean
  points: number
}

// Single pass over an owner's currently-active NFTs, keyed by
// site|age|material|form - only fully-upgraded artifacts are eligible to
// fill a pedestal slot. Shared by GET /progress (renders the whole grid)
// and POST /complete-cupboard (re-derives the 7 tokenIds for one specific
// cupboard rather than trusting client-submitted IDs).
function bucketEligibleNfts(ownerNfts: OwnerNftRow[]): Map<string, { id: string; tokenId: string }> {
  const bucket = new Map<string, { id: string; tokenId: string }>()
  for (const nft of ownerNfts) {
    const metadata = nft.metadata as Record<string, any>
    const { site, age, material, form } = metadata
    if (!site || !age || !material || !form) continue
    if (!isFullyMaxed(metadata)) continue
    const key = `${site}|${age}|${material}|${form}`
    if (!bucket.has(key)) bucket.set(key, { id: nft.id, tokenId: nft.tokenId })
  }
  return bucket
}

function buildMuseumGrid(
  bucket: Map<string, { id: string; tokenId: string }>,
  completedCupboardKeys: Set<string>
): Record<string, Record<string, Record<string, CupboardState>>> {
  const grid: Record<string, Record<string, Record<string, CupboardState>>> = {}

  for (const site of SITES) {
    grid[site] = {}
    for (const age of AGES) {
      grid[site][age] = {}
      for (const material of MATERIALS) {
        const filledForms: Record<string, string | null> = {}
        for (const form of FORMS) {
          filledForms[form] = bucket.get(`${site}|${age}|${material}|${form}`)?.id ?? null
        }
        grid[site][age][material] = {
          filledForms,
          complete: Object.values(filledForms).every((v) => v !== null),
          alreadyCompleted: completedCupboardKeys.has(getCupboardKey(site, age, material)),
          points: getCupboardPoints(getCupboardWeight(site, age, material)),
        }
      }
    }
  }

  return grid
}

// Parses the ERC721-shaped Transfer(address(0), owner, badgeId) log
// CollectionFacet emits on a successful completion. Deliberately does not
// try to decode against Essence's ERC20 Transfer(address,address,uint256)
// shape too - that log has only 3 topics (value isn't indexed), so
// decodeEventLog against this 4-topic (3-indexed-arg) ABI naturally throws
// for it instead of a false match.
function extractBadgeId(logs: readonly { topics: readonly `0x${string}`[]; data: `0x${string}` }[]): string | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: [BADGE_TRANSFER_EVENT], data: log.data, topics: log.topics as any })
      if (decoded.eventName === 'Transfer' && decoded.args.from === zeroAddress) {
        return decoded.args.tokenId.toString()
      }
    } catch {
      // Not a Transfer(address,address,uint256)-shaped log (e.g. the
      // TransferBatch burn, or Locked) - not what we're looking for.
    }
  }
  return null
}

const museum: FastifyPluginAsync = async (fastify): Promise<void> => {
  // ============================================================================
  // GET /progress - The full Site->Age->Material cupboard grid for a wallet.
  // ============================================================================
  fastify.get('/progress', async function (request, reply) {
    const { owner, chainId } = request.query as ProgressQuery

    if (!owner || !/^0x[a-fA-F0-9]{40}$/i.test(owner)) {
      reply.code(400)
      return { error: 'Invalid owner address' }
    }
    if (!chainId) {
      reply.code(400)
      return { error: 'Missing chainId' }
    }

    const normalizedOwner = owner.toLowerCase()
    const chainIdNum = parseInt(chainId, 10)

    const ownerNfts = await fastify.db
      .select({ id: nfts.id, tokenId: nfts.tokenId, metadata: nfts.metadata })
      .from(nfts)
      .where(and(eq(nfts.recipient, normalizedOwner), eq(nfts.chainId, chainIdNum), ne(nfts.status, 'consumed')))

    const completions = await fastify.db
      .select({ cupboardKey: cupboardCompletions.cupboardKey })
      .from(cupboardCompletions)
      .where(and(
        eq(cupboardCompletions.owner, normalizedOwner),
        eq(cupboardCompletions.chainId, chainIdNum),
        eq(cupboardCompletions.status, 'success')
      ))

    const bucket = bucketEligibleNfts(ownerNfts)
    const completedCupboardKeys = new Set(completions.map((c) => c.cupboardKey))

    return { grid: buildMuseumGrid(bucket, completedCupboardKeys) }
  })

  // ============================================================================
  // GET /leaderboard - Rank wallets by total points across every cupboard
  // they've completed. Built from cupboard_completions, not an on-chain
  // scan: every completion is a sponsored tx this API itself submits (see
  // POST /complete-cupboard's walletClient.writeContract below), so this
  // table is already the complete, authoritative record of every
  // completion that has ever happened on this chain - there's no wallet
  // this API doesn't already know about. leaderboardPoints(address) on
  // JaccardERC1155Facet (see CollectionFacet.completeCupboard) is still the
  // right source for one wallet's own total (trustlessly verifiable, no API
  // trust needed), but ranking *across* wallets would mean either indexing
  // every LeaderboardPointsAwarded log from scratch or enumerating
  // candidate addresses to query - unnecessary work when this table already
  // has the answer.
  // ============================================================================
  fastify.get('/leaderboard', async function (request, reply) {
    const { chainId, limit } = request.query as { chainId?: string; limit?: string }

    if (!chainId) {
      reply.code(400)
      return { error: 'Missing chainId' }
    }
    const chainIdNum = parseInt(chainId, 10)
    const limitNum = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 100)

    const rows = await fastify.db
      .select({
        owner: cupboardCompletions.owner,
        points: sql<number>`sum(${cupboardCompletions.points})`,
        badgeCount: sql<number>`count(*)`,
      })
      .from(cupboardCompletions)
      .where(and(eq(cupboardCompletions.chainId, chainIdNum), eq(cupboardCompletions.status, 'success')))
      .groupBy(cupboardCompletions.owner)
      .orderBy(sql`sum(${cupboardCompletions.points}) desc`)
      .limit(limitNum)

    return {
      leaderboard: rows.map((row, i) => ({
        rank: i + 1,
        owner: row.owner,
        points: Number(row.points),
        badgeCount: Number(row.badgeCount),
      })),
    }
  })

  // ============================================================================
  // POST /complete-cupboard - Freeze a completed cupboard: burns the 7
  // matching artifacts and mints a soulbound badge. Mirrors POST /forge/upgrade.
  // ============================================================================
  fastify.post('/complete-cupboard', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { walletClients, publicClients, getCollection, getJaccardNft } = fastify

    const body = request.body as CompleteCupboardBody
    const owner = body.owner?.toLowerCase()
    const sessionAddress = request.session!.address.toLowerCase()

    if (!owner || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      reply.code(400)
      return { error: 'Invalid owner address' }
    }
    if (owner !== sessionAddress) {
      reply.code(403)
      return { error: 'Owner must match authenticated address' }
    }
    if (!SITES.includes(body.site) || !AGES.includes(body.age) || !MATERIALS.includes(body.material)) {
      reply.code(400)
      return { error: 'Invalid site/age/material' }
    }

    const chainId = body.chainId as SupportedChainId
    const collectionArtifact = getCollection(chainId)
    const jaccardArtifact = getJaccardNft(chainId)
    if (!collectionArtifact || !jaccardArtifact) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    const publicClient = publicClients[chainId]
    const walletClient = walletClients[chainId]
    if (!walletClient) {
      reply.code(503)
      return { error: `Sponsored transactions not configured for chain: ${chainId}` }
    }

    const cupboardKey = getCupboardKey(body.site, body.age, body.material)

    const [existing] = await fastify.db
      .select()
      .from(cupboardCompletions)
      .where(and(
        eq(cupboardCompletions.owner, owner),
        eq(cupboardCompletions.cupboardKey, cupboardKey),
        eq(cupboardCompletions.status, 'success')
      ))
      .limit(1)

    if (existing) {
      reply.code(400)
      return { error: 'This cupboard has already been completed' }
    }

    const ownerNfts = await fastify.db
      .select({ id: nfts.id, tokenId: nfts.tokenId, metadata: nfts.metadata })
      .from(nfts)
      .where(and(eq(nfts.recipient, owner), eq(nfts.chainId, chainId), ne(nfts.status, 'consumed')))

    const bucket = bucketEligibleNfts(ownerNfts)
    const matches = FORMS.map((form) => bucket.get(`${body.site}|${body.age}|${body.material}|${form}`))

    if (matches.some((m) => !m)) {
      reply.code(400)
      return { error: 'Cupboard is not yet complete - every Form needs a fully-upgraded artifact' }
    }

    const filledNfts = matches as { id: string; tokenId: string }[]
    const tokenIds = filledNfts.map((n) => BigInt(n.tokenId))

    // Re-verify ownership on-chain for each - UX guard, same trust model as
    // Forge's /upgrade (the contract's own balance check is the real gate).
    for (const tokenId of tokenIds) {
      const balance = await publicClient.readContract({
        address: jaccardArtifact.address,
        abi: jaccardArtifact.abi as any,
        functionName: 'balanceOf',
        args: [owner as `0x${string}`, tokenId],
      } as any) as bigint
      if (balance < 1n) {
        reply.code(403)
        return { error: 'Owner no longer holds every artifact for this cupboard' }
      }
    }

    const points = getCupboardPoints(getCupboardWeight(body.site, body.age, body.material))

    const [completionRecord] = await fastify.db
      .insert(cupboardCompletions)
      .values({
        owner,
        chainId,
        site: body.site,
        age: body.age,
        material: body.material,
        cupboardKey,
        nftIds: filledNfts.map((n) => n.id),
        points,
        status: 'pending',
      })
      .returning()

    try {
      fastify.log.info({ owner, site: body.site, age: body.age, material: body.material, tokenIds: tokenIds.map(String) }, 'Completing cupboard')

      const hash = await walletClient.writeContract({
        address: collectionArtifact.address,
        abi: collectionArtifact.abi,
        functionName: 'completeCupboard',
        args: [owner as `0x${string}`, tokenIds, cupboardKey, BigInt(points)],
      } as any)

      fastify.log.info({ hash, chainId }, 'Cupboard completion submitted')

      // Same fast-response-then-confirm-async shape as /forge/upgrade - the
      // client has the hash immediately and picks up the terminal result
      // over the /museum/:requestId/room websocket.
      void (async () => {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain')

          const badgeId = extractBadgeId(receipt.logs)

          await fastify.db
            .update(nfts)
            .set({ status: 'consumed' } as any)
            .where(inArray(nfts.id, filledNfts.map((n) => n.id)))

          await fastify.db
            .update(cupboardCompletions)
            .set({ status: 'success', txHash: hash, badgeId })
            .where(eq(cupboardCompletions.id, completionRecord.id))

          fastify.log.info({ hash, chainId, badgeId }, 'Cupboard completion confirmed')
          broadcastRequestStatus(completionRecord.id, {
            type: WS_MSG.MUSEUM_STATUS,
            status: 'success',
            txHash: hash,
            site: body.site,
            age: body.age,
            material: body.material,
            points,
            badgeId,
          })
        } catch (error) {
          await fastify.db
            .update(cupboardCompletions)
            .set({ status: 'failed', errorMessage: (error as Error).message })
            .where(eq(cupboardCompletions.id, completionRecord.id))

          fastify.log.error({ error }, 'Cupboard completion failed')
          broadcastRequestStatus(completionRecord.id, { type: WS_MSG.MUSEUM_STATUS, status: 'failed', error: (error as Error).message })
        }
      })()

      return {
        success: true,
        requestId: completionRecord.id,
        txHash: hash,
        chainId,
        site: body.site,
        age: body.age,
        material: body.material,
        points,
      }
    } catch (error) {
      await fastify.db
        .update(cupboardCompletions)
        .set({ status: 'failed', errorMessage: (error as Error).message })
        .where(eq(cupboardCompletions.id, completionRecord.id))

      fastify.log.error({ error }, 'Cupboard completion failed')
      reply.code(500)
      return { error: 'Cupboard completion failed', details: (error as Error).message }
    }
  })

  // ============================================================================
  // WebSocket: GET /:requestId/room - terminal status of a cupboard completion
  // ============================================================================
  fastify.route({
    method: 'GET',
    url: '/:requestId/room',
    handler: () => {
      // Non-websocket requests - wsHandler takes over for upgrades
    },
    // @ts-expect-error - wsHandler is added by @fastify/websocket plugin
    wsHandler: async (socket: WebSocket, req: FastifyRequest) => {
      const { requestId } = req.params as { requestId: string }

      // Race guard: the completion may already have resolved (success/failed)
      // before this socket connects - send the terminal status immediately
      // instead of registering into a room that'll never receive a broadcast.
      const [existing] = await fastify.db
        .select()
        .from(cupboardCompletions)
        .where(eq(cupboardCompletions.id, requestId))
        .limit(1)

      if (existing && existing.status !== 'pending') {
        if (existing.status === 'success') {
          socket.send(JSON.stringify({
            type: WS_MSG.MUSEUM_STATUS,
            status: 'success',
            txHash: existing.txHash,
            site: existing.site,
            age: existing.age,
            material: existing.material,
            points: existing.points,
            badgeId: existing.badgeId,
          }))
        } else {
          socket.send(JSON.stringify({ type: WS_MSG.MUSEUM_STATUS, status: 'failed', error: existing.errorMessage ?? 'Completion failed' }))
        }
        socket.close()
        return
      }

      joinRequestRoom(requestId, socket)

      socket.on('close', () => {
        leaveRequestRoom(requestId, socket)
      })

      socket.on('error', (error: Error) => {
        fastify.log.error({ error, requestId }, 'Museum room WebSocket error')
      })
    }
  })
}

export default museum
