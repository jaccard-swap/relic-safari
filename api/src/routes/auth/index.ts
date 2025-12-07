import { FastifyPluginAsync } from 'fastify'
import { createPublicClient, http } from 'viem'
import { 
  parseSiweMessage, 
  //verifySiweMessage,
  generateSiweNonce
} from 'viem/siwe'
import { sepolia } from 'viem/chains'
import jwt from 'jsonwebtoken'

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

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL),
})

const auth: FastifyPluginAsync = async (fastify): Promise<void> => {
  // Generate nonce for SIWE
  fastify.get('/nonce', async function (request, reply) {
    const nonce = generateSiweNonce()
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
        return { success: false }
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
        return { success: false }
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
      return { success: false }
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