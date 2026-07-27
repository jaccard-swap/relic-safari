import { keccak256, toHex } from 'viem'

// ============================================================================
// MinHash Configuration
// ============================================================================

/**
 * Number of independent MinHash bands. Must match the diamond contract's
 * bytes8[MINHASH_BANDS] minHash layout (LibAppStorage.sol) exactly.
 */
export const MINHASH_BANDS = 20

/**
 * Seeds for MinHash signature computation.
 * CRITICAL: These must be identical across all services (frontend, backend, contracts).
 * Changing these will break all existing MinHash comparisons.
 * Length is derived from MINHASH_BANDS so the two can never silently drift
 * apart again (a prior version hardcoded numHashes separately from seeds.length,
 * which made every band past the seed array's end a duplicate, non-independent
 * hash instead of adding real Jaccard-estimate accuracy).
 */
export const MINHASH_SEEDS: readonly `0x${string}`[] = Array.from(
  { length: MINHASH_BANDS },
  (_, i) => `0x${(i + 1).toString(16).padStart(64, '0')}` as `0x${string}`
)

/**
 * Truncate a bytes32 hex string down to its low-order 8 bytes (bytes8),
 * matching the diamond contract's bytes8[20] minHash storage layout.
 */
function truncateToBytes8(hash: `0x${string}`): `0x${string}` {
  return ('0x' + hash.slice(-16)) as `0x${string}`
}

/**
 * Compute MinHash signature from traits.
 * Used for similarity matching between NFTs and standing bids.
 *
 * @param traits - Key-value pairs of traits (e.g., { rarity: 'legendary', material: 'gold' })
 * @returns Array of MINHASH_BANDS bytes8 hashes representing the MinHash signature
 */
export function computeMinHash(traits: Record<string, string | number>): `0x${string}`[] {
  const features: string[] = []

  for (const [key, value] of Object.entries(traits)) {
    // Skip non-trait fields
    if (key === 'name' || key === 'image' || key === 'description') continue
    features.push(`${key}:${value}`)
  }

  if (features.length === 0) {
    return Array(MINHASH_BANDS).fill('0x' + 'f'.repeat(16)) as `0x${string}`[]
  }

  const hashedFeatures = features.map(f => keccak256(toHex(f)))

  const signature: `0x${string}`[] = []

  for (let i = 0; i < MINHASH_BANDS; i++) {
    // Full bytes32 width for the running min-comparison (more entropy for a
    // fair minimum); only the winning value gets truncated below.
    let minHash = ('0x' + 'f'.repeat(64)) as `0x${string}`

    for (const featureHash of hashedFeatures) {
      const h = keccak256(toHex(featureHash + MINHASH_SEEDS[i]))
      if (BigInt(h) < BigInt(minHash)) {
        minHash = h
      }
    }

    signature.push(truncateToBytes8(minHash))
  }

  return signature
}

/**
 * Count matching bands between two MinHash signatures.
 * @returns Number of bands that match (0-MINHASH_BANDS)
 */
export function countMinHashMatches(a: string[], b: string[]): number {
  if (a.length !== MINHASH_BANDS || b.length !== MINHASH_BANDS) return 0
  let matches = 0
  for (let i = 0; i < MINHASH_BANDS; i++) {
    if (a[i].toLowerCase() === b[i].toLowerCase()) matches++
  }
  return matches
}

// ============================================================================
// Trait Pools - Archaeology Theme
// ============================================================================

export interface TraitValue {
  value: string
  weight: number
  levelUpCost?: number | null
}

export interface TraitPool {
  values: TraitValue[]
  upgradeable: boolean
}

export const TRAIT_POOLS: Record<string, TraitPool> = {
  rarity: {
    upgradeable: true,
    values: [
      { value: 'common', weight: 50 },
      { value: 'uncommon', weight: 30, levelUpCost: 10 },
      { value: 'rare', weight: 15, levelUpCost: 25 },
      { value: 'epic', weight: 4, levelUpCost: 50 },
      { value: 'legendary', weight: 1, levelUpCost: 100 },
    ],
  },
  age: {
    upgradeable: false,
    values: [
      { value: 'neolithic age', weight: 1 },
      { value: 'bronze age', weight: 2 },
      { value: 'iron age', weight: 3 },
      { value: 'classical era', weight: 3 },
      { value: 'medieval era', weight: 6 },
      { value: 'antediluvian', weight: 1 },
    ],
  },
  quality: {
    upgradeable: true,
    values: [
      { value: 'fragmented', weight: 40 },
      { value: 'worn', weight: 30, levelUpCost: 5 },
      { value: 'intact', weight: 20, levelUpCost: 15 },
      { value: 'pristine', weight: 8, levelUpCost: 30 },
      { value: 'immaculate', weight: 2, levelUpCost: 60 },
    ],
  },
  material: {
    upgradeable: false,
    values: [
      { value: 'clay', weight: 5 },
      { value: 'bone', weight: 4 },
      { value: 'bronze', weight: 3 },
      { value: 'iron', weight: 3 },
      { value: 'silver', weight: 2 },
      { value: 'jade', weight: 2 },
      { value: 'obsidian', weight: 2 },
      { value: 'gold', weight: 1 },
      { value: 'orichalcum', weight: 0.5 },
    ],
  },
  form: {
    upgradeable: false,
    values: [
      { value: 'tablet', weight: 3 },
      { value: 'idol', weight: 2 },
      { value: 'vessel', weight: 3 },
      { value: 'amulet', weight: 2 },
      { value: 'blade', weight: 2 },
      { value: 'scepter', weight: 1 },
      { value: 'mask', weight: 1 },
    ],
  },
  site: {
    upgradeable: false,
    values: [
      { value: 'sunken-temple', weight: 1 },
      { value: 'desert-tomb', weight: 1 },
      { value: 'mountain-shrine', weight: 1 },
      { value: 'forest-barrow', weight: 1 },
      { value: 'volcanic-forge', weight: 1 },
      { value: 'frozen-vault', weight: 1 },
      { value: 'coastal-ruins', weight: 1 },
    ],
  },
  inscription: {
    upgradeable: true,
    values: [
      { value: 'unmarked', weight: 10 },
      { value: 'faded', weight: 5, levelUpCost: 8 },
      { value: 'partial', weight: 3, levelUpCost: 20 },
      { value: 'legible', weight: 2, levelUpCost: 40 },
      { value: 'glowing', weight: 1, levelUpCost: 80 },
    ],
  },
}

// Convenience: Just the trait keys
export const TRAIT_KEYS = Object.keys(TRAIT_POOLS) as (keyof typeof TRAIT_POOLS)[]

// Convenience: Just the values for each trait (for UI dropdowns)
export const TRAIT_OPTIONS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TRAIT_POOLS).map(([key, pool]) => [
    key,
    pool.values.map(v => v.value)
  ])
)

// ============================================================================
// WebSocket Message Types
// ============================================================================

export const WS_MSG = {
  // Connection
  PING: 'ping',
  PONG: 'pong',
  JOINED: 'joined',
  LEFT: 'left',
  JOIN: 'join',
  ERROR: 'error',
  
  // Auction room - input
  CHAT: 'chat', // client sends chat message
  
  // Auction room - output
  EVENT: 'event', // server broadcasts event from append-only log
  
  // Auction feed
  AUCTIONS_LIST: 'auctions_list',
  NEW_AUCTION: 'new_auction',

  // Quarry dig room - terminal status of a sponsored mint (see api/src/lib/requestRooms.ts)
  DIG_STATUS: 'dig_status',
  // Polymerase fuse room - terminal status of a fusion (see api/src/lib/requestRooms.ts)
  POLYMERASE_STATUS: 'polymerase_status',
  // Forge upgrade room - terminal status of a direct Essence trait/overflow upgrade (see api/src/lib/requestRooms.ts)
  UPGRADE_STATUS: 'upgrade_status',
} as const

export type WsMsgType = typeof WS_MSG[keyof typeof WS_MSG]

// ============================================================================
// EIP-712 Type Definitions (Authoritative - matches JaccardSwap.sol)
// ============================================================================

// ERC20 permit data struct for bid signatures (v,r,s are NOT in the type - they're the signature!)
export const ERC20PermitDataTypes = {
  ERC20PermitData: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

// Bid type (includes ERC20PermitData as nested type)
export const BidTypes = {
  Bid: [
    { name: 'salt', type: 'bytes4' },
    { name: 'deadline', type: 'uint256' },
    { name: 'targetMinHash', type: 'bytes8[20]' },
    { name: 'minMatches', type: 'uint8' },
    { name: 'permit', type: 'ERC20PermitData' },
  ],
  ...ERC20PermitDataTypes,
} as const

// NFT permit type for JaccardERC1155
export const JaccardERC1155PermitTypes = {
  JaccardERC1155Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'salt', type: 'bytes4' },
  ],
} as const

// Full auction type (includes NFT permit as nested type)
export const AuctionTypes = {
  Auction: [
    { name: 'salt', type: 'bytes4' },
    { name: 'deadline', type: 'uint256' },
    { name: 'nft', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'reservePrice', type: 'uint256' },
    { name: 'nftPermit', type: 'JaccardERC1155Permit' },
    { name: 'nftPermitSignature', type: 'bytes' },
  ],
  ...JaccardERC1155PermitTypes,
} as const

// Standard ERC20 Permit type (for signing token approvals)
export const ERC20PermitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

// Domain names (must match contract EIP-712 domains)
// NOTE: Diamond uses unified "JaccardDiamond" domain for all facets
export const EIP712_DOMAINS = {
  JACCARD_SWAP: 'JaccardDiamond',
  JACCARD_ERC1155: 'JaccardDiamond',
  // Must match Scrip's ERC20Permit("Scrip") constructor arg exactly. A
  // mismatch here doesn't fail loudly: the signature is still well-formed,
  // just recovers to an unrelated address, so permit() reverts, the
  // allowance() fallback is never pre-approved either, and every auction
  // settlement dead-ends in NoValidBids(PaymentDeclined).
  SCRIP: 'Scrip',
} as const

