import { FastifyPluginAsync } from 'fastify'
import { createPublicClient, http } from 'viem'
import {
  parseSiweMessage,
  //verifySiweMessage,
  generateSiweNonce
} from 'viem/siwe'
import { hardhat, sepolia } from 'viem/chains'
import jwt from 'jsonwebtoken'
import { and, eq, gt, lt } from 'drizzle-orm'
import * as dbSchema from '@shared/database'
import { SIWE_NONCE_TTL_MS } from '@shared/constants'

const { siweNonces } = dbSchema

interface LoginBody {
  message: string
  signature: string
  nonce: string
  type: 'user' | 'admin'
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRY = '7d'

// Same split as web3.ts's sponsor account gating: each environment only
// ever talks to its own chain, so a SIWE message signed against the other
// one (e.g. a dev instance's 31337 message replayed at the production API)
// should never be redeemable here. viem's verifySiweMessage doesn't check
// this itself - chainId is just a text field inside the signed message, not
// part of the signature scheme (unlike EIP-712's domain separator) - so it's
// on us to compare it against what this process actually expects.
const EXPECTED_CHAIN_ID = process.env.NODE_ENV === 'production' ? 11155111 : 31337
const EXPECTED_CHAIN_NAME = process.env.NODE_ENV === 'production' ? sepolia.name : hardhat.name

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
})

const auth: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Generate nonce for SIWE. Persisted so /login can enforce single-use +
  // expiry - previously this just handed back a random string that nothing
  // ever checked, so a captured (message, signature) pair could be replayed
  // to mint fresh JWTs forever. Opportunistically sweeps expired rows here
  // rather than running a separate cleanup job - this is the one write path
  // that's guaranteed to run regularly.
  fastify.get('/nonce', async function (request, reply) {
    const nonce = generateSiweNonce()
    const expiresAt = new Date(Date.now() + SIWE_NONCE_TTL_MS)
    await fastify.db.delete(siweNonces).where(lt(siweNonces.expiresAt, new Date()))
    await fastify.db.insert(siweNonces).values({ nonce, expiresAt })
    fastify.log.info({ nonce }, 'Generated SIWE nonce')
    reply.type('text/plain')
    return nonce
  })

  // Check SIWE session from JWT
  fastify.get('/session', async function (request) {
    if (!request.session) {
      fastify.log.debug('Session check: no valid token')
      return { authenticated: false }
    }

    fastify.log.info({ address: request.session.address, type: request.session.type }, 'Session check: authenticated')
    return {
      authenticated: true,
      address: request.session.address,
      type: request.session.type
    }
  })

  // Verify SIWE message and return JWT
  fastify.post('/login', async function (request, reply) {
    const body = request.body as LoginBody

    try {
      // Parse message first to get address for logging
      const parsedMessage = parseSiweMessage(body.message)
      const address = parsedMessage.address

      if (!address) {
        fastify.log.warn({ message: body.message }, 'Login: failed to parse address from SIWE message')
        reply.code(401)
        return { success: false, error: 'Invalid sign-in message' }
      }

      if (parsedMessage.chainId !== EXPECTED_CHAIN_ID) {
        fastify.log.warn({ address, chainId: parsedMessage.chainId, expected: EXPECTED_CHAIN_ID }, 'Login: chainId mismatch')
        reply.code(401)
        return { success: false, error: `Please connect to ${EXPECTED_CHAIN_NAME} (or add it in your wallet) to sign in` }
      }

      // Atomically claim the nonce (delete-and-return) before doing any
      // signature work - a nonce not currently in the table, or one whose
      // expiresAt has passed, means this exact login attempt can't proceed,
      // whether that's because it was never issued, already redeemed once,
      // or went stale. Claiming first (rather than after a successful
      // verify) also means a captured signature can't be raced against a
      // still-valid nonce by firing two concurrent login requests.
      const [claimedNonce] = await fastify.db
        .delete(siweNonces)
        .where(and(eq(siweNonces.nonce, body.nonce), gt(siweNonces.expiresAt, new Date())))
        .returning()

      if (!claimedNonce) {
        fastify.log.warn({ address, nonce: body.nonce }, 'Login: nonce missing, already used, or expired')
        reply.code(401)
        return { success: false, error: 'Sign-in link expired - try again' }
      }

      fastify.log.info({ address, nonce: body.nonce, type: body.type }, 'Login: attempting SIWE verification')

      const valid = await publicClient.verifySiweMessage({
        message: body.message,
        signature: body.signature as `0x${string}`,
        nonce: body.nonce
      })

      if (!valid) {
        fastify.log.warn({ address, nonce: body.nonce }, 'Login: SIWE verification failed')
        reply.code(401)
        return { success: false, error: 'Signature verification failed' }
      }

      fastify.log.info({ address, type: body.type }, 'Login: SIWE verification successful, issuing JWT')

      const token = jwt.sign(
        { address, type: body.type },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      )

      return { success: true, address, type: body.type, token }
    } catch (error) {
      fastify.log.error({ error }, 'Login: SIWE verification error')
      reply.code(401)
      return { success: false, error: 'Sign-in failed' }
    }
  })

  // Clear session (JWT is stateless - client just discards token)
  fastify.delete('/session', async function () {
    fastify.log.info('Session: logout requested')
    return { authenticated: false }
  })

  // Base auth route
  fastify.get('/', async function () {
    return { message: 'Auth API' }
  })
}

export default auth