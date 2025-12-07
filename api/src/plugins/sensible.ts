import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import sensible, { FastifySensibleOptions } from '@fastify/sensible'

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default fp<FastifySensibleOptions>(async (fastify: FastifyInstance) => {
  fastify.register(sensible)
})
