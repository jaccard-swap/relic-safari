import { pgTable, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name'),
  password: text('password').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Artifact NFTs
export const nfts = pgTable('nfts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tokenId: text('token_id').notNull(),
  chainId: integer('chain_id').notNull(),
  contractAddress: text('contract_address').notNull(),
  recipient: text('recipient').notNull(),
  txHash: text('tx_hash').notNull(),
  // Artifact traits
  metadata: jsonb('metadata').notNull(), // { name, rarity, age, quality, material, form, site, inscription }
  minHash: jsonb('min_hash').notNull(),  // bytes32[5]
  // Trait upgrade tracking - level index for each upgradeable trait
  // e.g. { rarity: 2, quality: 1, inscription: 0 } = rare, worn, unmarked
  traitLevels: jsonb('trait_levels').default('{}'),
  // Uncapped Forge sink, unlocked once every upgradeable trait above is
  // maxed - a pure prestige counter, not one of the named TRAIT_POOLS traits
  overflowLevel: integer('overflow_level').notNull().default(0),
  // Polymerization history
  polymerizationCount: integer('polymerization_count').notNull().default(0),
  // Status: 'active' = owned, 'consumed' = polymerized into another
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('nfts_token_id_chain_idx').on(table.tokenId, table.chainId),
  index('nfts_recipient_idx').on(table.recipient),
  index('nfts_status_idx').on(table.status),
]);

// Polymerization events - history of artifact upgrades
export const polymerizations = pgTable('polymerizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Target artifact (A) - survives with upgrades
  targetNftId: text('target_nft_id').notNull().references(() => nfts.id),
  // Consumed artifact (B) - destroyed
  consumedNftId: text('consumed_nft_id').notNull().references(() => nfts.id),
  // Owner who performed the polymerization
  owner: text('owner').notNull(),
  chainId: integer('chain_id').notNull(),
  // What traits were upgraded
  upgradedTraits: jsonb('upgraded_traits').notNull(), // { rarity: { from: 'common', to: 'uncommon' }, ... }
  // Experience gained toward next level (didn't level up yet)
  experienceGained: jsonb('experience_gained').default('{}'), // { rarity: 5, quality: 3, ... }
  // Essence yield from non-matching traits
  essenceYield: integer('essence_yield').notNull().default(0),
  // Transaction
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('polymerizations_target_idx').on(table.targetNftId),
  index('polymerizations_owner_idx').on(table.owner),
  index('polymerizations_status_idx').on(table.status),
]);

// Direct Essence trait-upgrade events (Forge) - history of spending Essence
// on one artifact without consuming a second one. Overflow spends (once
// every real trait is maxed) log here too with traitKey: 'overflow' and
// fromValue/toValue as stringified counter values.
export const traitUpgrades = pgTable('trait_upgrades', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  nftId: text('nft_id').notNull().references(() => nfts.id),
  owner: text('owner').notNull(),
  chainId: integer('chain_id').notNull(),
  traitKey: text('trait_key').notNull(), // real TRAIT_POOLS key, or 'overflow'
  fromValue: text('from_value').notNull(),
  toValue: text('to_value').notNull(),
  essenceCost: integer('essence_cost').notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('trait_upgrades_nft_idx').on(table.nftId),
  index('trait_upgrades_owner_idx').on(table.owner),
]);

// Museum cupboard completions - freezing a completed cupboard (7
// fully-upgraded artifacts, one per Form value, sharing one
// Site+Age+Material combination) burns those artifacts and mints a
// soulbound Badge. Each owner+cupboard pair can only ever complete
// successfully once - see the partial unique index below.
export const cupboardCompletions = pgTable('cupboard_completions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  owner: text('owner').notNull(),
  chainId: integer('chain_id').notNull(),
  site: text('site').notNull(),
  age: text('age').notNull(),
  material: text('material').notNull(),
  cupboardKey: text('cupboard_key').notNull(), // hex bytes32, matches the on-chain arg
  nftIds: jsonb('nft_ids').notNull(), // the 7 burned nfts.id rows, for history
  points: integer('points').notNull(),
  badgeId: text('badge_id'), // on-chain badge tokenId, filled in once confirmed
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('cupboard_completions_owner_idx').on(table.owner),
  index('cupboard_completions_cupboard_idx').on(table.cupboardKey),
  // Only success rows are unique per owner+cupboard - a failed or still-
  // pending attempt must never block a later real completion.
  uniqueIndex('cupboard_completions_owner_cupboard_unique')
    .on(table.owner, table.cupboardKey)
    .where(sql`status = 'success'`),
]);

// Sponsorship requests for rate limiting
export const sponsorshipRequests = pgTable('sponsorship_requests', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recipient: text('recipient').notNull(),
  chainId: integer('chain_id').notNull(),
  requestType: text('request_type').notNull(), // 'nft_faucet', etc
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'failed'
  nftId: text('nft_id').references(() => nfts.id),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('sponsorship_recipient_created_idx').on(table.recipient, table.createdAt),
  index('sponsorship_recipient_type_idx').on(table.recipient, table.requestType),
]);

// Auctions
export const auctions = pgTable('auctions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Auction metadata
  title: text('title').notNull(),
  description: text('description'),
  // NFT being auctioned
  nftId: text('nft_id').references(() => nfts.id),
  nftContract: text('nft_contract').notNull(),
  nftTokenId: text('nft_token_id').notNull(),
  chainId: integer('chain_id').notNull(),
  // Payment token
  tokenContract: text('token_contract').notNull(),
  startingBid: text('starting_bid').notNull(), // stored as string for precision
  // Timing
  endTime: timestamp('end_time').notNull(),
  // Auctioneer (seller)
  auctioneer: text('auctioneer').notNull(), // wallet address
  // EIP-712 signature data for on-chain settlement
  salt: text('salt'), // bytes4 random salt for auction uniqueness
  signature: text('signature'), // auctioneer's EIP-712 signature
  auctioneerNonce: text('auctioneer_nonce'),
  // NFT permit for on-chain transfer
  nftPermit: jsonb('nft_permit'), // { owner, spender, tokenId, amount, deadline, salt }
  nftPermitSignature: text('nft_permit_signature'),
  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'ended', 'settled', 'cancelled'
  // Winner info (filled when auction ends)
  winner: text('winner'),
  winningBid: text('winning_bid'),
  settlementTxHash: text('settlement_tx_hash'),
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // Last time we checked for matching standing bids
  lastBidCheck: timestamp('last_bid_check'),
}, (table) => [
  index('auctions_auctioneer_idx').on(table.auctioneer),
  index('auctions_status_idx').on(table.status),
  index('auctions_end_time_idx').on(table.endTime),
  index('auctions_chain_idx').on(table.chainId),
]);

// Auction chat messages (legacy - kept for migration, use auctionEvents instead)
export const chats = pgTable('chats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  auctionId: text('auction_id').notNull().references(() => auctions.id),
  sender: text('sender').notNull(), // wallet address
  message: text('message').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('chats_auction_idx').on(table.auctionId),
  index('chats_created_idx').on(table.createdAt),
]);

// Auction events - append-only activity log
export const auctionEvents = pgTable('auction_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  auctionId: text('auction_id').notNull().references(() => auctions.id),
  type: text('type').notNull(), // 'created', 'bid', 'chat', 'settled', 'cancelled'
  actor: text('actor').notNull(), // wallet address who triggered event
  // Denormalized summary (no joins needed to display)
  summary: jsonb('summary'), // { amount?, message?, txHash?, winner? }
  // Optional reference to detailed record
  refId: text('ref_id'), // bid.id if we need full EIP-712 data later
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('auction_events_auction_idx').on(table.auctionId),
  index('auction_events_created_idx').on(table.createdAt),
]);

// Auction bids (tied to specific auction)
export const bids = pgTable('bids', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  auctionId: text('auction_id').notNull().references(() => auctions.id),
  bidder: text('bidder').notNull(), // wallet address
  amount: text('amount').notNull(), // stored as string for precision
  // Bid EIP-712 data
  salt: text('salt'), // bytes4 random salt
  deadline: timestamp('deadline'), // permit deadline
  // Similarity-based bidding (JaccardSwap)
  targetMinHash: jsonb('target_min_hash'), // bytes32[5] - desired traits as MinHash
  minMatches: integer('min_matches'), // 2-5 bands required to match
  // ERC20 permit for token transfer
  erc20Permit: jsonb('erc20_permit'), // { owner, spender, value, deadline, v, r, s }
  // Bid signature (EIP-712)
  signature: text('signature'),
  // Legacy fields (can remove later)
  bidSigHash: text('bid_sig_hash'),
  bidderNonce: text('bidder_nonce'),
  // Status
  status: text('status').notNull().default('active'), // 'active', 'outbid', 'winning', 'refunded'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('bids_auction_idx').on(table.auctionId),
  index('bids_bidder_idx').on(table.bidder),
  index('bids_amount_idx').on(table.amount),
]);

// ERC20 faucet claims (SCRIP token)
export const erc20Claims = pgTable('erc20_claims', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recipient: text('recipient').notNull(),
  chainId: integer('chain_id').notNull(),
  amount: text('amount').notNull(), // stored as string for precision
  txHash: text('tx_hash').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('erc20_claims_recipient_idx').on(table.recipient),
  index('erc20_claims_recipient_created_idx').on(table.recipient, table.createdAt),
]);

// Standing buy orders (not tied to any auction, match by MinHash similarity)
export const standingBids = pgTable('standing_bids', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bidder: text('bidder').notNull(), // wallet address
  chainId: integer('chain_id').notNull(),
  amount: text('amount').notNull(), // stored as string for precision (wei)
  // Trait matching via MinHash
  targetMinHash: jsonb('target_min_hash').notNull(), // bytes32[5] - computed from desired traits
  minMatches: integer('min_matches').notNull().default(3), // 2-5 bands required
  // Original traits used to generate the MinHash (for display)
  desiredTraits: jsonb('desired_traits').notNull(), // { rarity: 'legendary', material: 'orichalcum', ... }
  // EIP-712 bid signature data
  salt: text('salt').notNull(), // bytes4
  deadline: timestamp('deadline').notNull(),
  signature: text('signature').notNull(),
  // ERC20 permit for token transfer
  erc20Permit: jsonb('erc20_permit').notNull(), // { owner, spender, value, deadline, v, r, s }
  // Status: 'active' = available, 'matched' = attached to auction, 'expired' = deadline passed, 'cancelled'
  status: text('status').notNull().default('active'),
  // If matched, which auction
  matchedAuctionId: text('matched_auction_id').references(() => auctions.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('standing_bids_bidder_idx').on(table.bidder),
  index('standing_bids_status_idx').on(table.status),
  index('standing_bids_chain_idx').on(table.chainId),
  index('standing_bids_deadline_idx').on(table.deadline),
]);