import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import cookie, { FastifyCookieOptions } from '@fastify/cookie'

export default fp(async (fastify: FastifyInstance) => {
  const secret = process.env.COOKIE_SECRET
  
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('COOKIE_SECRET is required in production')
  }

  await (fastify as FastifyInstance).register(cookie as any, {
    secret: secret || 'dev-secret-not-for-production',
    hook: 'onRequest',
    parseOptions: {}
  } as FastifyCookieOptions)
})