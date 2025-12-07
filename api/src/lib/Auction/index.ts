// Types
export {
  MSG,
  type MsgType,
  type ClientInfo,
  type Room,
  type MessageHandlerContext,
  type ERC20PermitData,
  type CreateAuctionBody,
  type PlaceBidBody,
  type SettleAuctionBody,
} from './types'

// Room management
export {
  getRoom,
  deleteRoom,
  getRoomSize,
  broadcastToRoom,
  broadcastBid,
  subscribeFeed,
  unsubscribeFeed,
  getFeedSize,
  broadcastToFeed,
  broadcastNewAuction,
} from './rooms'

// Message handlers
export { handlePing, handleJoin } from './handlers'
export { handleChat } from './chat'

// Database operations
export {
  isValidAddress,
  ADDRESS_REGEX,
  createAuction,
  getAuction,
  getAuctionWithDetails,
  listAuctions,
  getAuctionsByAuctioneer,
  placeBid,
  cancelAuction,
  getAuctionForConsume,
  settleAuction,
  type ListAuctionsFilters,
  type PlaceBidResult,
  type CancelAuctionResult,
  type ConsumeAuctionResult,
  type SettleAuctionResult,
} from './db'
