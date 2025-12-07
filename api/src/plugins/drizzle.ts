import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { db } from '@shared/database'

export default fp(async (fastify: FastifyInstance) => {
  // Decorate fastify instance with our Drizzle database
  fastify.decorate('db', db)
})

// Extend FastifyInstance type to include our db
declare module 'fastify' {
  interface FastifyInstance {
    db: typeof db
  }
} 