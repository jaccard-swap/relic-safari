import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

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

export default fp(async (fastify: FastifyInstance) => {
  // Decorate request with session (null by default)
  fastify.decorateRequest('session', null)

  // Parse SIWE cookie on every request
  fastify.addHook('onRequest', async (request) => {
    const raw = (request as any).cookies?.siwe as string | undefined
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as SiweSession
      if (parsed.address && /^0x[a-fA-F0-9]{40}$/.test(parsed.address)) {
        request.session = parsed
      }
    } catch {
      // Malformed cookie - ignore, session stays null
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
