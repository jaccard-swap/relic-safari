import { FastifyPluginAsync, RouteOptions } from 'fastify'
import { WebsocketHandler } from '@fastify/websocket'

type WsRouteOptions = RouteOptions & {
  websocket: true
  wsHandler: WebsocketHandler
}

const ws: FastifyPluginAsync = async (fastify): Promise<void> => {
  const opts: WsRouteOptions = {
    method: 'GET',
    url: '/ws',
    handler: (req, reply) => {
      // Force clients to use the websocket upgrade, regular HTTP gets a 400-ish error
      reply.code(400).send({ error: 'WebSocket only' })
    },
    websocket: true,
    wsHandler: (socket, req) => {
      socket.on('message', (message: any) => {
        console.log('ws message', message.toString?.() ?? message)
      })

      socket.on('close', () => {
        console.log('ws client disconnected')
      })

      socket.on('error', (error: any) => {
        console.error('websocket error', error)
      })

      socket.on('ping', () => {
        console.log('ws client ping')
      })
    }
  }

  fastify.route(opts)
}

export default ws