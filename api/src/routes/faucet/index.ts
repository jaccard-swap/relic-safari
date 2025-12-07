import { FastifyPluginAsync } from 'fastify'
import * as dbSchema from '@shared/database'
import { computeMinHash, TRAIT_POOLS, type TraitPool } from '@shared/constants'
import { and, eq, gte, sql } from 'drizzle-orm'
import type { SupportedChainId } from '../../plugins/web3'

const { nfts, sponsorshipRequests, polymerizations } = dbSchema

function weightedRandom(pool: TraitPool): string {
  const totalWeight = pool.values.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  
  for (const item of pool.values) {
    random -= item.weight
    if (random <= 0) return item.value
  }
  
  return pool.values[pool.values.length - 1].value
}

// Capitalize first letter
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Generate artifact name from traits: "Antediluvian Bronze Tablet"
function generateArtifactName(traits: Record<string, string>): string {
  const parts: string[] = []
  
  // Age adjective (if present)
  if (traits.age) parts.push(cap(traits.age))
  
  // Material (if present)  
  if (traits.material) parts.push(cap(traits.material))
  
  // Form is required for name
  if (traits.form) {
    parts.push(cap(traits.form))
  } else {
    parts.push('Fragment')
  }
  
  // Add fingerprint suffix
  const fingerprint = Date.now().toString(36).slice(-4).toUpperCase()
  
  return `${parts.join(' ')} #${fingerprint}`
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

// Compare two MinHash signatures, return band-by-band match results
function compareMinHashes(a: string[], b: string[]): { 
  bands: { index: number; aHash: string; bHash: string; matches: boolean }[]
  matchCount: number
  eligible: boolean
  estimatedJaccard: number
} {
  const bands = []
  let matchCount = 0
  
  for (let i = 0; i < 5; i++) {
    const aHash = a[i] || '0x0'
    const bHash = b[i] || '0x0'
    const matches = aHash.toLowerCase() === bHash.toLowerCase()
    if (matches) matchCount++
    bands.push({ index: i, aHash, bHash, matches })
  }
  
  // Jaccard estimate: matchCount / totalBands
  const estimatedJaccard = matchCount / 5
  const eligible = matchCount >= 2 // 2/5 threshold
  
  return { bands, matchCount, eligible, estimatedJaccard }
}

// Get next upgrade level for a trait (returns null if maxed)
function getNextUpgradeLevel(traitKey: string, currentValue: string): { value: string; cost: number } | null {
  const pool = TRAIT_POOLS[traitKey]
  if (!pool || !pool.upgradeable) return null
  
  const currentIdx = pool.values.findIndex(v => v.value === currentValue)
  if (currentIdx < 0 || currentIdx >= pool.values.length - 1) return null
  
  const nextLevel = pool.values[currentIdx + 1]
  return { value: nextLevel.value, cost: nextLevel.levelUpCost || 0 }
}

// Get essence value of a trait at its current level
// Non-upgradeable traits have a base value of 5
const BASE_ESSENCE_VALUE = 5

function getTraitEssenceValue(traitKey: string, value: string): number {
  const pool = TRAIT_POOLS[traitKey]
  if (!pool) return 0
  
  if (!pool.upgradeable) {
    // Non-upgradeable traits yield base essence
    return BASE_ESSENCE_VALUE
  }
  
  const level = pool.values.find(v => v.value === value)
  // Upgradeable traits yield their levelUpCost as essence
  return level?.levelUpCost || BASE_ESSENCE_VALUE
}

// Compute polymerization result: A + B → upgraded A + essence
// Rules:
// - A keeps all its traits
// - Matching upgradeable traits → upgrade A's trait
// - Matching non-upgradeable traits → convert to essence
// - Non-matching traits from B → convert to essence
function computePolymerizationResult(
  targetMeta: Record<string, any>,
  consumedMeta: Record<string, any>
): {
  newMetadata: Record<string, any>
  upgradedTraits: Record<string, { from: string; to: string }>
  essenceYield: number
} {
  const newMetadata = { ...targetMeta }
  const upgradedTraits: Record<string, { from: string; to: string }> = {}
  let essenceYield = 0

  for (const key of Object.keys(TRAIT_POOLS)) {
    const pool = TRAIT_POOLS[key]
    const targetVal = targetMeta[key] as string | undefined
    const consumedVal = consumedMeta[key] as string | undefined

    // Skip if B doesn't have this trait
    if (!consumedVal) continue

    if (targetVal === consumedVal) {
      // Matching trait
      if (pool.upgradeable) {
        // Upgrade A's trait if possible
        const upgrade = getNextUpgradeLevel(key, targetVal)
        if (upgrade) {
          newMetadata[key] = upgrade.value
          upgradedTraits[key] = { from: targetVal, to: upgrade.value }
        }
        // If maxed, matching upgradeable yields no essence (already absorbed into upgrade)
      } else {
        // Matching non-upgradeable → convert to essence
        essenceYield += getTraitEssenceValue(key, consumedVal)
      }
    } else {
      // Non-matching trait from B → convert to essence
      essenceYield += getTraitEssenceValue(key, consumedVal)
    }
  }

  // Regenerate name with new traits
  const traits = Object.fromEntries(
    Object.entries(newMetadata).filter(([k]) => k !== 'name')
  ) as Record<string, string>
  newMetadata.name = generateArtifactName(traits)

  return { newMetadata, upgradedTraits, essenceYield }
}

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX = 3 // max mints per window

const faucet: FastifyPluginAsync = async (fastify): Promise<void> => {

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

    // Compare MinHashes
    const targetMinHash = targetNft.minHash as string[] || []
    const consumedMinHash = consumedNft.minHash as string[] || []
    const comparison = compareMinHashes(targetMinHash, consumedMinHash)

    // Compute what polymerization would produce
    const targetMeta = targetNft.metadata as Record<string, any>
    const consumedMeta = consumedNft.metadata as Record<string, any>
    const result = computePolymerizationResult(targetMeta, consumedMeta)

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
      eligible: comparison.eligible,
      minHash: {
        bands: comparison.bands,
        matchCount: comparison.matchCount,
        threshold: 2,
        estimatedJaccard: comparison.estimatedJaccard
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
    const { walletClients, publicClients, jaccardNft, web3Account } = fastify

    if (!walletClients || !web3Account) {
      reply.code(503)
      return { error: 'Service not configured' }
    }

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
    const artifact = jaccardNft[chainId]
    if (!artifact) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    const publicClient = publicClients[chainId]
    const walletClient = walletClients[chainId]

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

    // Compute polymerization result
    const targetMeta = targetNft.metadata as Record<string, any>
    const consumedMeta = consumedNft.metadata as Record<string, any>
    const { newMetadata, upgradedTraits, essenceYield } = computePolymerizationResult(targetMeta, consumedMeta)

    // Compute new minHash
    const newMinHash = computeMinHash(newMetadata) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]

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
          BigInt(essenceYield),
        ],
      } as any)

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash })

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

      return {
        success: true,
        txHash: hash,
        targetTokenId: body.targetTokenId,
        newMetadata,
        upgradedTraits,
        essenceYield,
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
  // POST / - Faucet mint new artifact
  // ============================================================================
  fastify.post('/', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { walletClients, publicClients, jaccardNft, web3Account } = fastify

    if (!walletClients || !web3Account) {
      reply.code(503)
      return { error: 'Faucet not configured' }
    }

    const body = request.body as FaucetBody
    const recipient = body.recipient?.toLowerCase()
    
    if (!recipient || !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      reply.code(400)
      return { error: 'Invalid recipient address' }
    }

    const chainId = body.chainId as SupportedChainId
    const artifact = jaccardNft[chainId]
    if (!artifact) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    const publicClient = publicClients[chainId]
    const walletClient = walletClients[chainId]

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
      const minHash = computeMinHash(metadata) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]

      fastify.log.info({ recipient, chainId, metadata }, 'Minting NFT')

      // Simulate to get tokenId
      const { result } = await publicClient.simulateContract({
        address: artifact.address,
        abi: artifact.abi,
        functionName: 'faucet',
        args: [recipient as `0x${string}`, 1n, minHash],
        account: web3Account,
      })
      const tokenId = result as bigint

      // Execute mint
      const hash = await walletClient.writeContract({
        address: artifact.address,
        abi: artifact.abi,
        functionName: 'faucet',
        args: [recipient as `0x${string}`, 1n, minHash],
      } as any)

      // Wait for confirmation
      await publicClient.waitForTransactionReceipt({ hash })

      // Record NFT
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

      // Update sponsorship request
      await fastify.db
        .update(sponsorshipRequests)
        .set({ status: 'success', nftId: nft.id })
        .where(eq(sponsorshipRequests.id, sponsorshipRequest.id))

      fastify.log.info({ tokenId: tokenId.toString(), hash, chainId }, 'NFT minted')

      return {
        success: true,
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
}

export default faucet

