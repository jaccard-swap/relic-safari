import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import * as dbSchema from '@shared/database'
import { computeMinHash, MINHASH_BANDS, TRAIT_POOLS, WS_MSG } from '@shared/constants'
import { generateArtifactName } from '../../lib/polymerase'
import { getNextUpgradeLevel, isFullyMaxed, getOverflowCost } from '../../lib/traitUpgrades'
import { joinRequestRoom, leaveRequestRoom, broadcastRequestStatus } from '../../lib/requestRooms'
import { and, eq } from 'drizzle-orm'
import { erc20Abi, parseEther } from 'viem'
import type { SupportedChainId } from '../../plugins/web3'

const { nfts, traitUpgrades } = dbSchema

const OVERFLOW_TRAIT_KEY = 'overflow'

interface UpgradeBody {
  owner: string
  tokenId: string
  traitKey: string
  chainId: number
}

interface SimulateQuery {
  nftId: string
}

const forge: FastifyPluginAsync = async (fastify): Promise<void> => {
  // ============================================================================
  // GET /simulate - Preview every trait's next level + cost for an artifact,
  // plus (once every real trait is maxed) the Overflow option.
  // ============================================================================
  fastify.get('/simulate', async function (request, reply) {
    const { nftId } = request.query as SimulateQuery

    if (!nftId) {
      reply.code(400)
      return { error: 'Missing nftId' }
    }

    const [nft] = await fastify.db
      .select()
      .from(nfts)
      .where(eq(nfts.id, nftId))
      .limit(1)

    if (!nft) {
      reply.code(404)
      return { error: 'Artifact not found' }
    }

    const metadata = nft.metadata as Record<string, any>

    const traits: Record<string, { current: string; upgradeable: boolean; next: { value: string; cost: number } | null }> = {}
    for (const key of Object.keys(TRAIT_POOLS)) {
      const pool = TRAIT_POOLS[key]
      const currentValue = metadata[key] as string | undefined
      if (!currentValue) continue
      traits[key] = {
        current: currentValue,
        upgradeable: pool.upgradeable,
        next: pool.upgradeable ? getNextUpgradeLevel(key, currentValue) : null,
      }
    }

    const overflow = isFullyMaxed(metadata)
      ? { currentLevel: nft.overflowLevel, cost: getOverflowCost(nft.overflowLevel) }
      : null

    return {
      nftId: nft.id,
      tokenId: nft.tokenId,
      traits,
      overflow,
    }
  })

  // ============================================================================
  // POST /upgrade - Spend Essence directly on one artifact (real trait, or
  // Overflow once every real trait is maxed). Mirrors POST /faucet/polymerase.
  // ============================================================================
  fastify.post('/upgrade', { preHandler: [fastify.requireAuth] }, async function (request, reply) {
    const { walletClients, publicClients, getJaccardNft, getEssence } = fastify

    const body = request.body as UpgradeBody
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

    const chainId = body.chainId as SupportedChainId
    const artifact = getJaccardNft(chainId)
    const essenceArtifact = getEssence(chainId)
    if (!artifact || !essenceArtifact) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    const publicClient = publicClients[chainId]
    const walletClient = walletClients[chainId]
    if (!walletClient) {
      reply.code(503)
      return { error: `Sponsored transactions not configured for chain: ${chainId}` }
    }

    const [nft] = await fastify.db
      .select()
      .from(nfts)
      .where(and(eq(nfts.tokenId, body.tokenId), eq(nfts.chainId, chainId)))
      .limit(1) as any[]

    if (!nft) {
      reply.code(404)
      return { error: 'Artifact not found' }
    }

    if (nft.status === 'consumed') {
      reply.code(400)
      return { error: 'Artifact already consumed' }
    }

    // Verify ownership on-chain
    const balance = await publicClient.readContract({
      address: artifact.address,
      abi: artifact.abi as any,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`, BigInt(body.tokenId)],
    } as any) as bigint

    if (balance < 1n) {
      reply.code(403)
      return { error: 'Owner does not have this artifact' }
    }

    const metadata = nft.metadata as Record<string, any>
    const minHash = nft.minHash as `0x${string}`[]
    if (!minHash || minHash.length !== MINHASH_BANDS) {
      reply.code(400)
      return { error: 'Invalid minHash data for artifact' }
    }

    let cost: number
    let fromValue: string
    let toValue: string
    let newMetadata: Record<string, any>
    let newMinHash: `0x${string}`[]

    if (body.traitKey === OVERFLOW_TRAIT_KEY) {
      if (!isFullyMaxed(metadata)) {
        reply.code(400)
        return { error: 'Overflow unlocks only once every upgradeable trait is maxed' }
      }
      cost = getOverflowCost(nft.overflowLevel)
      fromValue = String(nft.overflowLevel)
      toValue = String(nft.overflowLevel + 1)
      // Overflow isn't a Jaccard-relevant trait - metadata/minHash pass
      // through unchanged, only the Essence burn + overflowLevel counter move.
      newMetadata = metadata
      newMinHash = minHash
    } else {
      const pool = TRAIT_POOLS[body.traitKey]
      const currentValue = metadata[body.traitKey] as string | undefined
      const upgrade = currentValue ? getNextUpgradeLevel(body.traitKey, currentValue) : null
      if (!pool || !currentValue || !upgrade) {
        reply.code(400)
        return { error: 'Trait not upgradeable, not present on this artifact, or already maxed' }
      }
      cost = upgrade.cost
      fromValue = currentValue
      toValue = upgrade.value
      const bumped = { ...metadata, [body.traitKey]: upgrade.value }
      const traits = Object.fromEntries(Object.entries(bumped).filter(([k]) => k !== 'name')) as Record<string, string>
      bumped.name = generateArtifactName(traits)
      newMetadata = bumped
      newMinHash = computeMinHash(newMetadata) as `0x${string}`[]
    }

    const costWei = parseEther(cost.toString())

    // On-chain Essence balance check - UX guard, the contract enforces it too.
    const essenceBalance = await publicClient.readContract({
      address: essenceArtifact.address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner as `0x${string}`],
    })
    if (essenceBalance < costWei) {
      reply.code(400)
      return { error: `Insufficient essence: need ${cost}` }
    }

    const [upgradeRecord] = await fastify.db
      .insert(traitUpgrades)
      .values({
        nftId: nft.id,
        owner,
        chainId,
        traitKey: body.traitKey,
        fromValue,
        toValue,
        essenceCost: cost,
        status: 'pending',
      })
      .returning()

    try {
      fastify.log.info({ owner, tokenId: body.tokenId, traitKey: body.traitKey, fromValue, toValue, cost }, 'Forging upgrade')

      const hash = await walletClient.writeContract({
        address: artifact.address,
        abi: artifact.abi,
        functionName: 'upgradeTrait',
        args: [BigInt(body.tokenId), owner as `0x${string}`, newMinHash, costWei],
      } as any)

      fastify.log.info({ hash, chainId }, 'Forge upgrade submitted')

      // Same fast-response-then-confirm-async shape as /faucet and
      // /faucet/polymerase - the client has the hash immediately and picks
      // up the terminal result over the /forge/:requestId/room websocket.
      void (async () => {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash })
          if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain')

          if (body.traitKey === OVERFLOW_TRAIT_KEY) {
            await fastify.db
              .update(nfts)
              .set({ overflowLevel: nft.overflowLevel + 1 } as any)
              .where(eq(nfts.id, nft.id))
          } else {
            const pool = TRAIT_POOLS[body.traitKey]
            const newLevelIdx = pool.values.findIndex((v) => v.value === toValue)
            const newTraitLevels = { ...((nft.traitLevels as Record<string, number>) ?? {}), [body.traitKey]: newLevelIdx }
            await fastify.db
              .update(nfts)
              .set({ metadata: newMetadata, minHash: newMinHash, traitLevels: newTraitLevels } as any)
              .where(eq(nfts.id, nft.id))
          }

          await fastify.db
            .update(traitUpgrades)
            .set({ status: 'success', txHash: hash })
            .where(eq(traitUpgrades.id, upgradeRecord.id))

          fastify.log.info({ hash, chainId }, 'Forge upgrade complete')
          broadcastRequestStatus(upgradeRecord.id, {
            type: WS_MSG.UPGRADE_STATUS,
            status: 'success',
            txHash: hash,
            tokenId: body.tokenId,
            traitKey: body.traitKey,
            fromValue,
            toValue,
            essenceCost: cost,
            newMetadata,
          })
        } catch (error) {
          await fastify.db
            .update(traitUpgrades)
            .set({ status: 'failed', errorMessage: (error as Error).message })
            .where(eq(traitUpgrades.id, upgradeRecord.id))

          fastify.log.error({ error }, 'Forge upgrade failed')
          broadcastRequestStatus(upgradeRecord.id, { type: WS_MSG.UPGRADE_STATUS, status: 'failed', error: (error as Error).message })
        }
      })()

      return {
        success: true,
        requestId: upgradeRecord.id,
        txHash: hash,
        chainId,
        tokenId: body.tokenId,
        traitKey: body.traitKey,
        fromValue,
        toValue,
        essenceCost: cost,
      }
    } catch (error) {
      await fastify.db
        .update(traitUpgrades)
        .set({ status: 'failed', errorMessage: (error as Error).message })
        .where(eq(traitUpgrades.id, upgradeRecord.id))

      fastify.log.error({ error }, 'Forge upgrade failed')
      reply.code(500)
      return { error: 'Upgrade failed', details: (error as Error).message }
    }
  })

  // ============================================================================
  // WebSocket: GET /:requestId/room - terminal status of a Forge upgrade
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

      // Race guard: the upgrade may already have resolved (success/failed)
      // before this socket connects - send the terminal status immediately
      // instead of registering into a room that'll never receive a broadcast.
      const [existing] = await fastify.db
        .select()
        .from(traitUpgrades)
        .where(eq(traitUpgrades.id, requestId))
        .limit(1)

      if (existing && existing.status !== 'pending') {
        if (existing.status === 'success') {
          const [nft] = await fastify.db.select().from(nfts).where(eq(nfts.id, existing.nftId)).limit(1)
          socket.send(JSON.stringify({
            type: WS_MSG.UPGRADE_STATUS,
            status: 'success',
            txHash: existing.txHash,
            tokenId: nft?.tokenId,
            traitKey: existing.traitKey,
            fromValue: existing.fromValue,
            toValue: existing.toValue,
            essenceCost: existing.essenceCost,
            newMetadata: nft?.metadata,
          }))
        } else {
          socket.send(JSON.stringify({ type: WS_MSG.UPGRADE_STATUS, status: 'failed', error: existing.errorMessage ?? 'Upgrade failed' }))
        }
        socket.close()
        return
      }

      joinRequestRoom(requestId, socket)

      socket.on('close', () => {
        leaveRequestRoom(requestId, socket)
      })

      socket.on('error', (error: Error) => {
        fastify.log.error({ error, requestId }, 'Forge room WebSocket error')
      })
    }
  })
}

export default forge
