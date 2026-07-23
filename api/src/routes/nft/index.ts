import { FastifyPluginAsync } from 'fastify'
import { nfts } from '@shared/database'
import { computeMinHash } from '@shared/constants'
import { eq, desc, and, or, isNull, ne } from 'drizzle-orm'
import type { SupportedChainId } from '../../plugins/web3'

interface NftQuery {
  address?: string
  chainId?: string
}

interface SyncOwnershipBody {
  nftId: string
  newOwner: string
  chainId: number
}

const nftRoutes: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Get NFTs owned by a wallet address
  fastify.get('/by-owner/:address', async function (request, reply) {
    const { address } = request.params as { address: string }
    const { chainId } = request.query as NftQuery

    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
      reply.code(400)
      return { error: 'Invalid wallet address' }
    }

    const normalizedAddress = address.toLowerCase()

    try {
      let query = fastify.db
        .select({
          id: nfts.id,
          tokenId: nfts.tokenId,
          chainId: nfts.chainId,
          contractAddress: nfts.contractAddress,
          metadata: nfts.metadata,
          minHash: nfts.minHash,
          txHash: nfts.txHash,
          createdAt: nfts.createdAt,
        })
        .from(nfts)
        .where(and(
          eq(nfts.recipient, normalizedAddress),
          or(isNull(nfts.status), ne(nfts.status, 'consumed'))
        ))
        .orderBy(desc(nfts.createdAt))

      const results = await query

      // Filter by chainId if provided
      const filtered = chainId 
        ? results.filter(n => n.chainId === parseInt(chainId))
        : results

      return { 
        nfts: filtered,
        count: filtered.length 
      }
    } catch (error) {
      fastify.log.error({ error, address }, 'Failed to fetch NFTs')
      reply.code(500)
      return { error: 'Failed to fetch NFTs' }
    }
  })

  // Get single NFT by id (internal UUID)
  fastify.get('/:id', async function (request, reply) {
    const { id } = request.params as { id: string }

    try {
      const [nft] = await fastify.db
        .select()
        .from(nfts)
        .where(eq(nfts.id, id))
        .limit(1)

      if (!nft) {
        reply.code(404)
        return { error: 'NFT not found' }
      }

      return { nft }
    } catch (error) {
      fastify.log.error({ error, id }, 'Failed to fetch NFT')
      reply.code(500)
      return { error: 'Failed to fetch NFT' }
    }
  })

  // ERC-1155 metadata JSON endpoint - matches contract URI pattern
  // Contract: https://relic-safari.social/api/nft/{id}.json
  fastify.get('/:tokenId.json', async function (request, reply) {
    const { tokenId } = request.params as { tokenId: string }

    try {
      const [nft] = await fastify.db
        .select()
        .from(nfts)
        .where(eq(nfts.tokenId, tokenId))
        .limit(1)

      if (!nft) {
        reply.code(404)
        return { error: 'NFT not found' }
      }

      const metadata = nft.metadata as Record<string, any>
      
      // Reserved fields per OpenSea/ERC-721 metadata standard
      const reserved = ['name', 'description', 'image', 'external_url', 'animation_url', 'background_color']
      
      // Build attributes from non-reserved fields
      const attributes = Object.entries(metadata)
        .filter(([key]) => !reserved.includes(key))
        .map(([trait_type, value]) => ({ trait_type, value }))

      reply.header('Content-Type', 'application/json')
      reply.header('Cache-Control', 'public, max-age=3600')

      // OpenSea metadata standard
      // https://docs.opensea.io/docs/metadata-standards
      return {
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        external_url: `https://relic-safari.social/nft/${tokenId}`,
        animation_url: metadata.animation_url,
        background_color: metadata.background_color,
        attributes,
      }
    } catch (error) {
      fastify.log.error({ error, tokenId }, 'Failed to fetch NFT metadata')
      reply.code(500)
      return { error: 'Failed to fetch NFT metadata' }
    }
  })

  // POST /sync-ownership - Update NFT ownership after auction settlement
  // This is a lightweight alternative to a full event indexer
  fastify.post('/sync-ownership', async function (request, reply) {
    const body = request.body as SyncOwnershipBody
    const { publicClients, getJaccardNft } = fastify

    fastify.log.info({ body }, 'sync-ownership request received')

    if (!body.nftId || !body.newOwner || !body.chainId) {
      fastify.log.warn({ body }, 'sync-ownership missing required fields')
      reply.code(400)
      return { error: 'Missing required fields: nftId, newOwner, chainId' }
    }

    if (!/^0x[a-fA-F0-9]{40}$/i.test(body.newOwner)) {
      reply.code(400)
      return { error: 'Invalid newOwner address' }
    }

    const chainId = body.chainId as SupportedChainId
    const artifact = getJaccardNft(chainId)

    if (!artifact || !publicClients?.[chainId]) {
      reply.code(400)
      return { error: `Unsupported chain: ${body.chainId}` }
    }

    try {
      // Get the NFT from DB
      const [nft] = await fastify.db
        .select()
        .from(nfts)
        .where(eq(nfts.id, body.nftId))
        .limit(1)

      if (!nft) {
        reply.code(404)
        return { error: 'NFT not found' }
      }

      // Verify on-chain that newOwner actually owns this NFT
      // Poll until state change or timeout (handles RPC lag after tx confirmation)
      const publicClient = publicClients[chainId]
      const pollIntervalMs = 1000
      const timeoutMs = 30000 // 30 seconds max
      const startTime = Date.now()
      
      let balance = 0n
      let attempts = 0
      while (Date.now() - startTime < timeoutMs) {
        attempts++
        balance = await publicClient.readContract({
          address: artifact.address,
          abi: artifact.abi as any,
          functionName: 'balanceOf',
          args: [body.newOwner as `0x${string}`, BigInt(nft.tokenId)],
        } as any) as bigint
        
        if (balance >= 1n) {
          fastify.log.info({ attempts, elapsed: Date.now() - startTime, nftId: body.nftId }, 'On-chain balance confirmed')
          break
        }
        
        await new Promise(r => setTimeout(r, pollIntervalMs))
      }

      if (balance < 1n) {
        fastify.log.warn({ nftId: body.nftId, newOwner: body.newOwner, tokenId: nft.tokenId, attempts }, 'New owner does not hold NFT after polling timeout')
        reply.code(400)
        return { error: 'New owner does not hold this NFT on-chain (timeout)' }
      }

      // Update ownership in DB
      const [updated] = await fastify.db
        .update(nfts)
        .set({
          recipient: body.newOwner.toLowerCase(),
          updatedAt: new Date(),
        })
        .where(eq(nfts.id, body.nftId))
        .returning()

      fastify.log.info({ 
        nftId: body.nftId, 
        tokenId: nft.tokenId,
        previousOwner: nft.recipient,
        newOwner: body.newOwner.toLowerCase(),
        chainId 
      }, 'NFT ownership synced')

      return { 
        success: true, 
        nft: {
          id: updated.id,
          tokenId: updated.tokenId,
          owner: updated.recipient,
        }
      }
    } catch (error) {
      fastify.log.error({ error, nftId: body.nftId }, 'Failed to sync NFT ownership')
      reply.code(500)
      return { error: 'Failed to sync NFT ownership' }
    }
  })

  // Seed test NFT - development only
  if (process.env.NODE_ENV === 'development') {
    fastify.post('/seed', async function (request, reply) {
      const body = request.body as {
        owner: string
        chainId: number
        metadata: Record<string, string>
        tokenId: string
      }

      if (!body.owner || !body.chainId || !body.metadata || !body.tokenId) {
        reply.code(400)
        return { error: 'Missing required fields: owner, chainId, metadata, tokenId' }
      }

      // Compute minHash from metadata using shared function
      const minHash = computeMinHash(body.metadata as Record<string, string | number>)

      try {
        const [nft] = await fastify.db
          .insert(nfts)
          .values({
            tokenId: body.tokenId,
            chainId: body.chainId,
            contractAddress: '0x0000000000000000000000000000000000000000',
            recipient: body.owner.toLowerCase(),
            metadata: body.metadata,
            minHash,
            txHash: '0x' + '0'.repeat(64),
            status: 'active',
          })
          .returning()

        return { id: nft.id, tokenId: nft.tokenId }
      } catch (error) {
        fastify.log.error({ error }, 'Failed to seed NFT')
        reply.code(500)
        return { error: 'Failed to seed NFT' }
      }
    })
  }
}

export default nftRoutes

