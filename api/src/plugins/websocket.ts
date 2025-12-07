import fp from 'fastify-plugin'
import websocket from '@fastify/websocket'
import type { FastifyInstance } from 'fastify'

export default fp(async (fastify: FastifyInstance) => {
  await fastify.register(websocket, {
    options: {
      // WebSocket server options
      clientTracking: true,
      maxPayload: 1048576, // 1MB max payload
    }
  })
}) 