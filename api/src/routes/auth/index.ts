import { FastifyPluginAsync } from 'fastify'
import { createPublicClient, http } from 'viem'
import { 
  parseSiweMessage, 
  //verifySiweMessage,
  generateSiweNonce
} from 'viem/siwe'
import { sepolia } from 'viem/chains'

interface LoginBody {
  message: string
  signature: string
  nonce: string
  type: 'user' | 'admin'
}

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

  // Check SIWE session from signed cookie
  fastify.get('/session', async function (request, reply) {
    const raw = ((request as any).cookies)?.siwe as string | undefined

    if (!raw) {
      fastify.log.debug('Session check: no cookie found')
      return { authenticated: false }
    }

    try {
      const session = JSON.parse(raw) as { address: string; type: LoginBody['type'] }
      if (!session.address) {
        fastify.log.warn('Session check: cookie found but no address')
        return { authenticated: false }
      }
      fastify.log.info({ address: session.address, type: session.type }, 'Session check: authenticated')
      return {
        authenticated: true,
        address: session.address,
        type: session.type
      }
    } catch (error) {
      // Malformed cookie – clear it to be safe
      fastify.log.warn({ error }, 'Session check: malformed cookie, clearing')
      ;(reply as any).clearCookie('siwe', {
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN_NAME : 'localhost'
      })
      return { authenticated: false }
    }
  })

  // Verify SIWE message and set cookie
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

      fastify.log.info({ address, type: body.type }, 'Login: SIWE verification successful, setting session cookie')

      ;(reply as any).setCookie(
        'siwe',
        JSON.stringify({
          address,
          type: body.type
        }),
        {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN_NAME : 'localhost'
        }
      )

      return { success: true, address, type: body.type }
    } catch (error) {
      fastify.log.error({ error }, 'Login: SIWE verification error')
      reply.code(401)
      return { success: false }
    }
  })

  // Clear session
  fastify.delete('/session', async function (request, reply) {
    fastify.log.info('Session: clearing SIWE cookie')
    ;(reply as any).clearCookie('siwe', {
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN_NAME : 'localhost'
    })
    return { authenticated: false }
  })

  // Base auth route
  fastify.get('/', async function () {
    return { message: 'Auth API' }
  })
}

export default auth