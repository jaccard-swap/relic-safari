import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'

export interface SiweSession {
  address: string
  type: 'user' | 'admin'
}

declare module 'fastify' {
  interface FastifyRequest {
    session: SiweSession | null
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production')
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'

export default fp(async (fastify: FastifyInstance) => {
  // Decorate request with session (null by default)
  fastify.decorateRequest('session', null)

  // Parse JWT from Authorization header on every request
  fastify.addHook('onRequest', async (request) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SiweSession
      if (decoded.address && /^0x[a-fA-F0-9]{40}$/.test(decoded.address)) {
        request.session = decoded
      }
    } catch {
      // Invalid token - ignore, session stays null
    }
  })

  // Decorator for routes that require authentication
  fastify.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.session) {
      reply.code(401)
      throw new Error('Authentication required')
    }
  })

  fastify.log.info('SIWE auth plugin loaded')
})
