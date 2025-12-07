import type { WebSocket } from '@fastify/websocket'
import type { FastifyBaseLogger } from 'fastify'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { WS_MSG, type WsMsgType } from '@shared/constants'

// Re-export MSG for backwards compatibility
export const MSG = WS_MSG
export type MsgType = WsMsgType

// Client info stored per socket
export interface ClientInfo {
  address?: string
  joinedAt: number
}

// Room = Map of socket -> client info
export type Room = Map<WebSocket, ClientInfo>

// Message handler context
export interface MessageHandlerContext {
  auctionId: string
  socket: WebSocket
  room: Room
  clientInfo: ClientInfo | undefined
  db: NodePgDatabase<any>
  log: FastifyBaseLogger
}

// ERC20 permit data for bids
export interface ERC20PermitData {
  owner: string
  spender: string
  value: string
  deadline: string
  v: number
  r: string
  s: string
}

// API request bodies
export interface CreateAuctionBody {
  title: string
  description?: string
  nftContract: string
  nftTokenId: string
  chainId: number
  tokenContract: string
  startingBid: string
  endTime: number // unix timestamp
  auctioneer: string
  // EIP-712 auction signature data
  salt: string // bytes4 random salt (required for on-chain settlement)
  signature: string // auctioneer's EIP-712 signature (required for on-chain settlement)
  auctioneerNonce?: string
  // NFT permit for on-chain transfer
  nftPermit: {
    owner: string
    spender: string
    tokenId: string
    amount: string
    deadline: string
    salt: string
  }
  nftPermitSignature: string
  nftId?: string
}

export interface PlaceBidBody {
  bidder: string
  amount: string
  // EIP-712 bid data
  salt?: string
  deadline?: number // unix timestamp
  // Similarity-based bidding (JaccardSwap)
  targetMinHash?: string[] // 5 bytes32 hashes
  minMatches?: number // 2-5 bands required to match
  // ERC20 permit for token transfer
  erc20Permit?: ERC20PermitData
  // Bid signature
  signature?: string
  // Legacy
  bidSigHash?: string
  bidderNonce?: string
}

export interface SettleAuctionBody {
  auctioneer: string
  txHash: string
  winner?: string
  winningBid?: string
}

