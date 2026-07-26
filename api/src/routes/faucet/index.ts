import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import * as dbSchema from '@shared/database'
import { computeMinHash, countMinHashMatches, MINHASH_BANDS, TRAIT_POOLS, WS_MSG, type TraitPool } from '@shared/constants'
import { computePolymerizationResult, generateArtifactName, POLYMERASE_MIN_MATCHES } from '../../lib/polymerase'
import { joinRequestRoom, leaveRequestRoom, broadcastRequestStatus } from '../../lib/requestRooms'
import { and, eq, gte, sql } from 'drizzle-orm'
import { parseEther } from 'viem'
import type { SupportedChainId } from '../../plugins/web3'

const { nfts, sponsorshipRequests, polymerizations, erc20Claims } = dbSchema

function weightedRandom(pool: TraitPool): string {
  const totalWeight = pool.values.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const item of pool.values) {
    random -= item.weight
    if (random <= 0) return item.value
  }
  
  return pool.values[pool.values.length - 1].value
}

function generateRandomMetadata(traitCount: number): Record<string, string | number> {
  const keys = Object.keys(TRAIT_POOLS)
  const selectedKeys = keys.sort(() => Math.random() - 0.5).slice(0, traitCount)
  
  // Always include form for naming
  if (!selectedKeys.includes('form')) {
    selectedKeys[selectedKeys.length - 1] = 'form'
  }
  
  const traits: Record<string, string> = {}
  
  for (const key of selectedKeys) {
    traits[key] = weightedRandom(TRAIT_POOLS[key])
  }
  
  const metadata: Record<string, string | number> = {
    name: generateArtifactName(traits),
    ...traits,
  }
  
  return metadata
}


interface FaucetBody {
  recipient: string
  chainId: number
}

interface PolymeraseBody {
  owner: string
  targetTokenId: string  // A - survives
  consumedTokenId: string // B - consumed
  chainId: number
}

interface SimulatePolymeraseQuery {
  targetNftId: string
  consumedNftId: string
}

// Validate required env vars at load time
if (!process.env.RATE_LIMIT_WINDOW_MS) {
  throw new Error('RATE_LIMIT_WINDOW_MS env var required')
}
if (!process.env.RATE_LIMIT_MAX) {
  throw new Error('RATE_LIMIT_MAX env var required')
}

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS)
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX)

interface Erc20ClaimBody {
  recipient: string
  chainId: number
  amount: string
  txHash: string
}

const faucet: FastifyPluginAsync = async (fastify): Promise<void> => {

  // ============================================================================
  // GET /erc20/history - Get user's ERC20 faucet claim history
  // ============================================================================
  fastify.get('/erc20/history', async function (request, reply) {
    const { address, chainId, limit = '10' } = request.query as { address?: string; chainId?: string; limit?: string }

    if (!address) {
      reply.code(400)
      return { error: 'Missing address parameter' }
    }

    const recipient = address.toLowerCase()
    const parsedLimit = Math.min(parseInt(limit) || 10, 50)

    const history = await fastify.db
      .select({
        id: erc20Claims.id,
        amount: erc20Claims.amount,
        txHash: erc20Claims.txHash,
        chainId: erc20Claims.chainId,
        createdAt: erc20Claims.createdAt,
      })
      .from(erc20Claims)
      .where(and(
        eq(erc20Claims.recipient, recipient),
        chainId ? eq(erc20Claims.chainId, parseInt(chainId)) : undefined
      ))
      .orderBy(sql`${erc20Claims.createdAt} DESC`)
      .limit(parsedLimit)

    return { 
      history,
      count: history.length,
    }
  })

  // ============================================================================
  // POST /erc20/record - Record an ERC20 faucet claim
  // ============================================================================
  fastify.post('/erc20/record', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const body = request.body as Erc20ClaimBody
    const sessionAddress = request.session!.address.toLowerCase()
    const recipient = body.recipient?.toLowerCase()

    // Validate
    if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      reply.code(400)
      return { error: 'Invalid recipient address' }
    }

    if (!body.txHash || !/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
      reply.code(400)
      return { error: 'Invalid transaction hash' }
    }

    // Ensure authenticated user matches recipient
    if (recipient !== sessionAddress) {
      reply.code(403)
      return { error: 'Recipient must match authenticated address' }
    }

    // Check for duplicate txHash
    const existing = await fastify.db
      .select({ id: erc20Claims.id })
      .from(erc20Claims)
      .where(eq(erc20Claims.txHash, body.txHash.toLowerCase()))
      .limit(1)

    if (existing.length > 0) {
      // Already recorded, return success (idempotent)
      return { success: true, duplicate: true }
    }

    // Record the claim
    const [claim] = await fastify.db
      .insert(erc20Claims)
      .values({
        recipient,
        chainId: body.chainId,
        amount: body.amount,
        txHash: body.txHash.toLowerCase(),
      })
      .returning()

    fastify.log.info({ recipient, chainId: body.chainId, txHash: body.txHash }, 'ERC20 claim recorded')

    return { success: true, claim }
  })

  // ============================================================================
  // GET /polymerase/history - Get user's polymerization history
  // ============================================================================
  fastify.get('/polymerase/history', async function (request, reply) {
    const { address, chainId, limit = '10' } = request.query as { address?: string; chainId?: string; limit?: string }

    if (!address) {
      reply.code(400)
      return { error: 'Missing address parameter' }
    }

    const owner = address.toLowerCase()
    const parsedLimit = Math.min(parseInt(limit) || 10, 50)

    const history = await fastify.db
      .select({
        id: polymerizations.id,
        targetNftId: polymerizations.targetNftId,
        consumedNftId: polymerizations.consumedNftId,
        upgradedTraits: polymerizations.upgradedTraits,
        experienceGained: polymerizations.experienceGained,
        essenceYield: polymerizations.essenceYield,
        txHash: polymerizations.txHash,
        status: polymerizations.status,
        createdAt: polymerizations.createdAt,
        // Join target NFT metadata
        targetMetadata: nfts.metadata,
        targetTokenId: nfts.tokenId,
      })
      .from(polymerizations)
      .leftJoin(nfts, eq(polymerizations.targetNftId, nfts.id))
      .where(and(
        eq(polymerizations.owner, owner),
        eq(polymerizations.status, 'success'),
        chainId ? eq(polymerizations.chainId, parseInt(chainId)) : undefined
      ))
      .orderBy(sql`${polymerizations.createdAt} DESC`)
      .limit(parsedLimit)

    return { 
      history,
      count: history.length,
    }
  })
  
  // ============================================================================
  // GET /polymerase/simulate - Preview polymerization result without executing
  // ============================================================================
  fastify.get('/polymerase/simulate', async function (request, reply) {
    const { targetNftId, consumedNftId } = request.query as SimulatePolymeraseQuery

    if (!targetNftId || !consumedNftId) {
      reply.code(400)
      return { error: 'Missing targetNftId or consumedNftId' }
    }

    if (targetNftId === consumedNftId) {
      reply.code(400)
      return { error: 'Cannot fuse artifact with itself' }
    }

    // Fetch both NFTs from DB
    const [targetNft] = await fastify.db
      .select()
      .from(nfts)
      .where(eq(nfts.id, targetNftId))
      .limit(1)

    const [consumedNft] = await fastify.db
      .select()
      .from(nfts)
      .where(eq(nfts.id, consumedNftId))
      .limit(1)

    if (!targetNft || !consumedNft) {
      reply.code(404)
      return { error: 'One or both artifacts not found' }
    }

    // Fetch on-chain minHashes (source of truth)
    const { publicClients, getJaccardNft } = fastify
    const chainId = targetNft.chainId as SupportedChainId
    const artifact = getJaccardNft(chainId)
    const publicClient = publicClients[chainId]

    if (!artifact || !publicClient) {
      reply.code(400)
      return { error: `Unsupported chain: ${chainId}` }
    }

    // Reads can fail outright (RPC/network error) - without this catch that
    // bubbles up as an unhandled 500 instead of a clean, expected error.
    let targetMinHashOnChain: `0x${string}`[]
    let consumedMinHashOnChain: `0x${string}`[]
    try {
      targetMinHashOnChain = await publicClient.readContract({
        address: artifact.address,
        abi: artifact.abi as any,
        functionName: 'getMinHashByTokenId',
        args: [BigInt(targetNft.tokenId)],
      } as any) as `0x${string}`[]

      consumedMinHashOnChain = await publicClient.readContract({
        address: artifact.address,
        abi: artifact.abi as any,
        functionName: 'getMinHashByTokenId',
        args: [BigInt(consumedNft.tokenId)],
      } as any) as `0x${string}`[]
    } catch (error) {
      fastify.log.warn({ error, targetNftId: targetNft.id, consumedNftId: consumedNft.id }, 'Failed to read on-chain minHash')
      reply.code(502)
      return { error: 'Failed to read on-chain artifact data' }
    }

    // getMinHashByTokenId doesn't revert for a tokenId that was never
    // minted (JaccardERC1155Facet.sol:77-80 is a plain mapping read) - it
    // silently returns Solidity's zero-initialized bytes8[20]. Left
    // unchecked, two never-minted/desynced tokenIds (e.g. stale DB rows
    // after a chain reset) would both read back identical all-zero
    // signatures and match on all 20 bands, reporting false eligibility.
    // A real mint's minHash can't organically land on all-zero (that would
    // require every one of 20 independent keccak256 mins to hit exactly
    // zero), so treating it as "not minted" is safe.
    const ZERO_BYTES8 = '0x0000000000000000'
    const isUnminted = (hash: `0x${string}`[]) => hash.every((h) => h.toLowerCase() === ZERO_BYTES8)
    if (isUnminted(targetMinHashOnChain) || isUnminted(consumedMinHashOnChain)) {
      reply.code(404)
      return { error: 'One or both artifacts not found on-chain' }
    }

    // Validate on-chain minHashes
    if (!targetMinHashOnChain || !consumedMinHashOnChain ||
        targetMinHashOnChain.length !== MINHASH_BANDS || consumedMinHashOnChain.length !== MINHASH_BANDS) {
      reply.code(400)
      return { error: 'Invalid on-chain minHash data' }
    }

    // Sync DB if on-chain minHash differs (on-chain is source of truth)
    const targetDbHash = targetNft.minHash as string[] || []
    const consumedDbHash = consumedNft.minHash as string[] || []
    
    const targetMismatch = targetMinHashOnChain.some((h, i) => h.toLowerCase() !== (targetDbHash[i] || '').toLowerCase())
    const consumedMismatch = consumedMinHashOnChain.some((h, i) => h.toLowerCase() !== (consumedDbHash[i] || '').toLowerCase())
    
    if (targetMismatch) {
      fastify.log.warn({ nftId: targetNft.id, tokenId: targetNft.tokenId }, 'Syncing stale minHash from chain')
      await fastify.db.update(nfts).set({ minHash: [...targetMinHashOnChain] } as any).where(eq(nfts.id, targetNft.id))
    }
    if (consumedMismatch) {
      fastify.log.warn({ nftId: consumedNft.id, tokenId: consumedNft.tokenId }, 'Syncing stale minHash from chain')
      await fastify.db.update(nfts).set({ minHash: [...consumedMinHashOnChain] } as any).where(eq(nfts.id, consumedNft.id))
    }

    // Use on-chain minHashes for comparison (source of truth)
    const matchCount = countMinHashMatches(targetMinHashOnChain, consumedMinHashOnChain)
    const eligible = matchCount >= POLYMERASE_MIN_MATCHES

    // Build band-by-band comparison for UI (using on-chain values)
    const bands = []
    for (let i = 0; i < MINHASH_BANDS; i++) {
      const aHash = targetMinHashOnChain[i]
      const bHash = consumedMinHashOnChain[i]
      const matches = aHash.toLowerCase() === bHash.toLowerCase()
      bands.push({ index: i, aHash, bHash, matches })
    }
    const estimatedJaccard = matchCount / MINHASH_BANDS

    // Compute what polymerization would produce
    const targetMeta = targetNft.metadata as Record<string, any>
    const consumedMeta = consumedNft.metadata as Record<string, any>
    const result = computePolymerizationResult(targetMeta, consumedMeta, matchCount)

    // Trait-by-trait breakdown
    const traitBreakdown: Record<string, {
      target: string | null
      consumed: string | null
      matches: boolean
      upgradeable: boolean
      action: 'upgrade' | 'essence' | 'keep' | 'none'
    }> = {}

    for (const key of Object.keys(TRAIT_POOLS)) {
      const pool = TRAIT_POOLS[key]
      const targetVal = targetMeta[key] as string | undefined
      const consumedVal = consumedMeta[key] as string | undefined
      const matches = targetVal === consumedVal && !!targetVal
      
      let action: 'upgrade' | 'essence' | 'keep' | 'none' = 'none'
      if (targetVal && consumedVal) {
        if (matches && pool.upgradeable) {
          action = 'upgrade'
        } else if (!matches && pool.upgradeable) {
          action = 'essence'
        } else if (matches) {
          action = 'keep'
        }
      } else if (targetVal) {
        action = 'keep'
      }

      traitBreakdown[key] = {
        target: targetVal || null,
        consumed: consumedVal || null,
        matches,
        upgradeable: pool.upgradeable,
        action
      }
    }

    return {
      eligible,
      tier: result.tier,
      minHash: {
        bands,
        matchCount,
        threshold: POLYMERASE_MIN_MATCHES,
        estimatedJaccard
      },
      traitBreakdown,
      result: {
        newMetadata: result.newMetadata,
        upgradedTraits: result.upgradedTraits,
        essenceYield: result.essenceYield
      },
      target: {
        id: targetNft.id,
        tokenId: targetNft.tokenId,
        metadata: targetMeta
      },
      consumed: {
        id: consumedNft.id,
        tokenId: consumedNft.tokenId,
        metadata: consumedMeta
      }
    }
  })

  // ============================================================================
  // POST /polymerase - Polymerize artifact B onto artifact A
  // ============================================================================
  fastify.post('/polymerase', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { walletClients, publicClients, getJaccardNft } = fastify

    const body = request.body as PolymeraseBody
    const owner = body.owner?.toLowerCase()
    const sessionAddress = request.session!.address.toLowerCase()
    
    if (!owner || !/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      reply.code(400)
      return { error: 'Invalid owner address' }
    }

    // Ensure authenticated user matches owner param
    if (owner !== sessionAddress) {
      reply.code(403)
      return { error: 'Owner must match authenticated address' }
    }

    const chainId = body.chainId as SupportedChainId
    const artifact = getJaccardNft(chainId)
    if (!artifact) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    const publicClient = publicClients[chainId]
    const walletClient = walletClients[chainId]
    if (!walletClient) {
      reply.code(503)
      return { error: `Sponsored transactions not configured for chain: ${chainId}` }
    }

    // Get both NFTs from DB
    const [targetNft] = await fastify.db
      .select()
      .from(nfts)
      .where(and(
        eq(nfts.tokenId, body.targetTokenId),
        eq(nfts.chainId, chainId)
      ))
      .limit(1) as any[]

    const [consumedNft] = await fastify.db
      .select()
      .from(nfts)
      .where(and(
        eq(nfts.tokenId, body.consumedTokenId),
        eq(nfts.chainId, chainId)
      ))
      .limit(1) as any[]

    if (!targetNft || !consumedNft) {
      reply.code(404)
      return { error: 'One or both artifacts not found' }
    }

    // Check status (after schema reset)
    if (targetNft.status === 'consumed' || consumedNft.status === 'consumed') {
      reply.code(400)
      return { error: 'One or both artifacts already consumed' }
    }

    // Verify ownership on-chain
    const targetBalance = await publicClient.readContract({
      address: artifact.address,
      abi: artifact.abi as any,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`, BigInt(body.targetTokenId)],
    } as any) as bigint

    const consumedBalance = await publicClient.readContract({
      address: artifact.address,
      abi: artifact.abi as any,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`, BigInt(body.consumedTokenId)],
    } as any) as bigint

    if (targetBalance < 1n || consumedBalance < 1n) {
      reply.code(403)
      return { error: 'Owner does not have both artifacts' }
    }

    // Verify minHash compatibility - this is the only place eligibility is
    // enforced now (see lib/polymerase.ts POLYMERASE_MIN_MATCHES comment).
    const targetMinHash = targetNft.minHash as string[]
    const consumedMinHash = consumedNft.minHash as string[]

    if (!targetMinHash || !consumedMinHash || targetMinHash.length !== MINHASH_BANDS || consumedMinHash.length !== MINHASH_BANDS) {
      reply.code(400)
      return { error: 'Invalid minHash data for one or both artifacts' }
    }

    const matches = countMinHashMatches(targetMinHash, consumedMinHash)
    if (matches < POLYMERASE_MIN_MATCHES) {
      reply.code(400)
      return { error: `Insufficient similarity: ${matches}/${MINHASH_BANDS} matches (need ${POLYMERASE_MIN_MATCHES}/${MINHASH_BANDS})` }
    }

    // Compute polymerization result (essence yield scales with resonance tier)
    const targetMeta = targetNft.metadata as Record<string, any>
    const consumedMeta = consumedNft.metadata as Record<string, any>
    const { newMetadata, upgradedTraits, essenceYield, tier } = computePolymerizationResult(targetMeta, consumedMeta, matches)

    // Compute new minHash
    const newMinHash = computeMinHash(newMetadata) as `0x${string}`[]

    // Create pending polymerization record
    const [polyRecord] = await fastify.db
      .insert(polymerizations)
      .values({
        targetNftId: targetNft.id,
        consumedNftId: consumedNft.id,
        owner,
        chainId,
        upgradedTraits,
        essenceYield,
        status: 'pending',
      })
      .returning()

    try {
      fastify.log.info({
        owner,
        targetTokenId: body.targetTokenId,
        consumedTokenId: body.consumedTokenId,
        upgradedTraits,
        essenceYield,
        tier,
        matches,
      }, 'Polymerizing artifacts')

      // Execute polymerization on-chain
      const hash = await walletClient.writeContract({
        address: artifact.address,
        abi: artifact.abi,
        functionName: 'polymerase',
        args: [
          BigInt(body.targetTokenId),
          BigInt(body.consumedTokenId),
          owner as `0x${string}`,
          1n,
          newMinHash,
          parseEther(essenceYield.toString()),
        ],
      } as any)

      fastify.log.info({ hash, chainId }, 'Polymerization submitted')

      // Confirmation happens off the request/response lifecycle - the
      // client already has the hash and can jump to Etherscan immediately,
      // then picks up the terminal result over the
      // /polymerase/:requestId/room websocket (see below) instead of
      // blocking the HTTP response on waitForTransactionReceipt.
      void (async () => {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          // waitForTransactionReceipt resolves once a receipt exists, not
          // once the tx succeeded - viem doesn't throw on a reverted receipt,
          // so without this a reverted fusion would still get recorded as
          // 'success' below.
          if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain')

          // Update target NFT with new metadata
          await fastify.db
            .update(nfts)
            .set({
              metadata: newMetadata,
              minHash: newMinHash,
            } as any)
            .where(eq(nfts.id, targetNft.id))

          // Mark consumed NFT as consumed (burned on-chain)
          await fastify.db
            .update(nfts)
            .set({ status: 'consumed' } as any)
            .where(eq(nfts.id, consumedNft.id))

          // Update polymerization record
          await fastify.db
            .update(polymerizations)
            .set({ status: 'success', txHash: hash })
            .where(eq(polymerizations.id, polyRecord.id))

          fastify.log.info({ hash, chainId }, 'Polymerization complete')
          broadcastRequestStatus(polyRecord.id, {
            type: WS_MSG.POLYMERASE_STATUS,
            status: 'success',
            txHash: hash,
            targetTokenId: body.targetTokenId,
            newMetadata,
            upgradedTraits,
            essenceYield,
          })
        } catch (error) {
          // Update polymerization record with failure
          await fastify.db
            .update(polymerizations)
            .set({ status: 'failed', errorMessage: (error as Error).message })
            .where(eq(polymerizations.id, polyRecord.id))

          fastify.log.error({ error }, 'Polymerization failed')
          broadcastRequestStatus(polyRecord.id, { type: WS_MSG.POLYMERASE_STATUS, status: 'failed', error: (error as Error).message })
        }
      })()

      return {
        success: true,
        requestId: polyRecord.id,
        txHash: hash,
        chainId,
        targetTokenId: body.targetTokenId,
        newMetadata,
        upgradedTraits,
        essenceYield,
        tier,
      }
    } catch (error) {
      // Update polymerization record with failure
      await fastify.db
        .update(polymerizations)
        .set({ status: 'failed', errorMessage: (error as Error).message })
        .where(eq(polymerizations.id, polyRecord.id))

      fastify.log.error({ error }, 'Polymerization failed')
      reply.code(500)
      return { error: 'Polymerization failed', details: (error as Error).message }
    }
  })

  // ============================================================================
  // GET /status - Current dig rate-limit usage for the authenticated session
  // ============================================================================
  fastify.get('/status', { preHandler: [fastify.requireAuth] }, async function (request) {
    const sessionAddress = request.session!.address.toLowerCase()
    // Mirrors the exact bypass in POST / below - keeps the displayed status
    // truthful about whether a dig will actually be blocked.
    const bypassed = process.env.NODE_ENV === 'development'

    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
    const recent = await fastify.db
      .select({ createdAt: sponsorshipRequests.createdAt })
      .from(sponsorshipRequests)
      .where(and(
        eq(sponsorshipRequests.recipient, sessionAddress),
        eq(sponsorshipRequests.requestType, 'nft_faucet'),
        eq(sponsorshipRequests.status, 'success'),
        gte(sponsorshipRequests.createdAt, windowStart)
      ))
      .orderBy(sql`${sponsorshipRequests.createdAt} ASC`)

    const count = recent.length
    // The window is rolling, not a fixed daily reset - the count only drops
    // once the oldest request within it ages out, so that's what "available
    // again" actually depends on.
    const nextAvailableAt = !bypassed && count >= RATE_LIMIT_MAX
      ? new Date(recent[0].createdAt.getTime() + RATE_LIMIT_WINDOW_MS).toISOString()
      : null

    return { count, max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, nextAvailableAt, bypassed }
  })

  // ============================================================================
  // POST / - Faucet mint new artifact
  // ============================================================================
  fastify.post('/', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { walletClients, publicClients, getJaccardNft } = fastify

    const body = request.body as FaucetBody
    const recipient = body.recipient?.toLowerCase()
    
    if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      reply.code(400)
      return { error: 'Invalid recipient address' }
    }

    const chainId = body.chainId as SupportedChainId
    const artifact = getJaccardNft(chainId)
    if (!artifact) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    const publicClient = publicClients[chainId]
    const walletClient = walletClients[chainId]
    if (!walletClient) {
      reply.code(503)
      return { error: `Faucet not configured for chain: ${chainId}` }
    }

    // Rate limit by authenticated session address (not spoofable body)
    const sessionAddress = request.session!.address.toLowerCase()
    if (process.env.NODE_ENV !== 'development') {
      const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
      const recentRequests = await fastify.db
        .select({ count: sql<number>`count(*)` })
        .from(sponsorshipRequests)
        .where(and(
          eq(sponsorshipRequests.recipient, sessionAddress),
          eq(sponsorshipRequests.requestType, 'nft_faucet'),
          eq(sponsorshipRequests.status, 'success'),
          gte(sponsorshipRequests.createdAt, windowStart)
        ))

      if (recentRequests[0].count >= RATE_LIMIT_MAX) {
        reply.code(429)
        return { error: 'Rate limit exceeded', retryAfter: RATE_LIMIT_WINDOW_MS / 1000 }
      }
    }

    // Create pending request
    const [sponsorshipRequest] = await fastify.db
      .insert(sponsorshipRequests)
      .values({
        recipient,
        chainId: body.chainId,
        requestType: 'nft_faucet',
        status: 'pending',
      })
      .returning()

    // Gaussian-ish distribution: 1-8 traits, centered around 4-5
    const traitWeights = [
      { count: 1, weight: 1 },   // ~2%
      { count: 2, weight: 3 },   // ~6%
      { count: 3, weight: 7 },   // ~14%
      { count: 4, weight: 12 },  // ~24%
      { count: 5, weight: 12 },  // ~24%
      { count: 6, weight: 7 },   // ~14%
      { count: 7, weight: 5 },   // ~10%
      { count: 8, weight: 3 },   // ~6%
    ]
    const totalWeight = traitWeights.reduce((sum, t) => sum + t.weight, 0)
    let roll = Math.random() * totalWeight
    let traitCount = 4
    for (const { count, weight } of traitWeights) {
      roll -= weight
      if (roll <= 0) {
        traitCount = count
        break
      }
    }

    try {
      const metadata = generateRandomMetadata(traitCount)
      const minHash = computeMinHash(metadata) as `0x${string}`[]

      fastify.log.info({ recipient, chainId, metadata }, 'Minting NFT')

      // Simulate to get tokenId
      const { result } = await publicClient.simulateContract({
        address: artifact.address,
        abi: artifact.abi,
        functionName: 'faucet',
        args: [recipient as `0x${string}`, 1n, minHash],
        account: walletClient.account,
      })
      const tokenId = result as bigint

      // Execute mint
      const hash = await walletClient.writeContract({
        address: artifact.address,
        abi: artifact.abi,
        functionName: 'faucet',
        args: [recipient as `0x${string}`, 1n, minHash],
      } as any)

      fastify.log.info({ tokenId: tokenId.toString(), hash, chainId }, 'NFT mint submitted')

      // Confirmation happens off the request/response lifecycle - the
      // client already has the hash and can jump to Etherscan immediately,
      // then picks up the terminal result over the /:requestId/room
      // websocket (see below) instead of blocking the HTTP response on
      // waitForTransactionReceipt.
      void (async () => {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          // See the identical check in the polymerase confirmation block
          // above - without it, a reverted mint gets recorded as 'success'
          // and wrongly counts against the 5/day dig limit.
          if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain')

          const [nft] = await fastify.db
            .insert(nfts)
            .values({
              tokenId: tokenId.toString(),
              chainId,
              contractAddress: artifact.address.toLowerCase(),
              recipient,
              txHash: hash,
              metadata,
              minHash,
            })
            .returning()

          await fastify.db
            .update(sponsorshipRequests)
            .set({ status: 'success', nftId: nft.id })
            .where(eq(sponsorshipRequests.id, sponsorshipRequest.id))

          fastify.log.info({ tokenId: tokenId.toString(), hash, chainId }, 'NFT minted')
          broadcastRequestStatus(sponsorshipRequest.id, { type: WS_MSG.DIG_STATUS, status: 'success', nft })
        } catch (error) {
          await fastify.db
            .update(sponsorshipRequests)
            .set({ status: 'failed', errorMessage: (error as Error).message })
            .where(eq(sponsorshipRequests.id, sponsorshipRequest.id))

          fastify.log.error({ error }, 'Faucet mint failed')
          broadcastRequestStatus(sponsorshipRequest.id, { type: WS_MSG.DIG_STATUS, status: 'failed', error: (error as Error).message })
        }
      })()

      return {
        success: true,
        requestId: sponsorshipRequest.id,
        tokenId: tokenId.toString(),
        hash,
        chainId,
        metadata,
        minHash,
      }
    } catch (error) {
      // Update sponsorship request with failure
      await fastify.db
        .update(sponsorshipRequests)
        .set({ status: 'failed', errorMessage: (error as Error).message })
        .where(eq(sponsorshipRequests.id, sponsorshipRequest.id))

      fastify.log.error({ error }, 'Faucet mint failed')
      reply.code(500)
      return { error: 'Mint failed', details: (error as Error).message }
    }
  })

  // ============================================================================
  // WebSocket: GET /:requestId/room - terminal status of a sponsored mint
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

      // Race guard: the mint may already have resolved (success/failed)
      // before this socket connects - send the terminal status immediately
      // instead of registering into a room that'll never receive a broadcast.
      const [existing] = await fastify.db
        .select()
        .from(sponsorshipRequests)
        .where(eq(sponsorshipRequests.id, requestId))
        .limit(1)

      if (existing && existing.status !== 'pending') {
        if (existing.status === 'success' && existing.nftId) {
          const [nft] = await fastify.db.select().from(nfts).where(eq(nfts.id, existing.nftId)).limit(1)
          socket.send(JSON.stringify({ type: WS_MSG.DIG_STATUS, status: 'success', nft }))
        } else {
          socket.send(JSON.stringify({ type: WS_MSG.DIG_STATUS, status: 'failed', error: existing.errorMessage ?? 'Mint failed' }))
        }
        socket.close()
        return
      }

      joinRequestRoom(requestId, socket)

      socket.on('close', () => {
        leaveRequestRoom(requestId, socket)
      })

      socket.on('error', (error: Error) => {
        fastify.log.error({ error, requestId }, 'Dig room WebSocket error')
      })
    }
  })

  // ============================================================================
  // WebSocket: GET /polymerase/:requestId/room - terminal status of a fusion
  // ============================================================================
  fastify.route({
    method: 'GET',
    url: '/polymerase/:requestId/room',
    handler: () => {
      // Non-websocket requests - wsHandler takes over for upgrades
    },
    // @ts-expect-error - wsHandler is added by @fastify/websocket plugin
    wsHandler: async (socket: WebSocket, req: FastifyRequest) => {
      const { requestId } = req.params as { requestId: string }

      // Race guard: the fusion may already have resolved (success/failed)
      // before this socket connects - send the terminal status immediately
      // instead of registering into a room that'll never receive a broadcast.
      const [existing] = await fastify.db
        .select()
        .from(polymerizations)
        .where(eq(polymerizations.id, requestId))
        .limit(1)

      if (existing && existing.status !== 'pending') {
        if (existing.status === 'success') {
          const [targetNft] = await fastify.db.select().from(nfts).where(eq(nfts.id, existing.targetNftId)).limit(1)
          socket.send(JSON.stringify({
            type: WS_MSG.POLYMERASE_STATUS,
            status: 'success',
            txHash: existing.txHash,
            targetTokenId: targetNft?.tokenId,
            newMetadata: targetNft?.metadata,
            upgradedTraits: existing.upgradedTraits,
            essenceYield: existing.essenceYield,
          }))
        } else {
          socket.send(JSON.stringify({ type: WS_MSG.POLYMERASE_STATUS, status: 'failed', error: existing.errorMessage ?? 'Fusion failed' }))
        }
        socket.close()
        return
      }

      joinRequestRoom(requestId, socket)

      socket.on('close', () => {
        leaveRequestRoom(requestId, socket)
      })

      socket.on('error', (error: Error) => {
        fastify.log.error({ error, requestId }, 'Polymerase room WebSocket error')
      })
    }
  })
}

export default faucet

