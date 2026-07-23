// Seeds one fixed, memorable NFT + auction pair into the dev database so
// testing the Standing Buy Order UI doesn't require minting an NFT and
// signing a real auction first - just connect a wallet, fill the trait
// picker with DEMO_TRAITS below, and submit. Once the standing bid is
// created, opening the seeded auction's room (which the UI already does on
// click) fires the 500ms check-bids re-check and the bid should auto-attach.
//
// Not wired into db-setup/the fresh-deploy pipeline: shared/database's
// Dockerfile deliberately has no @shared/constants access (see its "no
// workspace complexity" comment), and this needs the real computeMinHash so
// the seeded NFT's stored minHash actually matches what the browser
// computes for the same traits. Run against the already-running dev stack:
//   API_URL=http://localhost:3000 npx ts-node --project test/tsconfig.json scripts/seed-standing-bid-demo.ts
//
// Idempotent: if an active demo auction already exists, this just prints
// its info and exits rather than creating a duplicate.
import jwt from 'jsonwebtoken'
import { MINHASH_BANDS } from '@shared/constants'

const API_BASE = process.env.API_URL || 'http://localhost:3000'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const CHAIN_ID = 31337

const DEMO_TITLE = '🌱 Standing Bid Demo Auction'
const DEMO_TOKEN_ID = '777001'
const DEMO_OWNER = '0x' + 'D0'.repeat(19) + '01' // 0xD0D0...D001 - recognizably a fixture, valid 40-hex address
const DEMO_AUCTIONEER = '0x' + 'D0'.repeat(19) + '02' // 0xD0D0...D002

// One value per @shared/constants TRAIT_KEYS entry - pick exactly these in
// the web Standing Buy Order form's trait dropdowns to get a full 20/20
// MinHash match against the seeded NFT.
export const DEMO_TRAITS: Record<string, string> = {
  rarity: 'legendary',
  age: 'antediluvian',
  quality: 'immaculate',
  material: 'orichalcum',
  form: 'scepter',
  site: 'volcanic-forge',
  inscription: 'glowing',
}

function authHeader(address: string) {
  const token = jwt.sign({ address: address.toLowerCase(), type: 'user' }, JWT_SECRET)
  return { Authorization: `Bearer ${token}` }
}

function futureUnix(seconds: number): number {
  return Math.floor(Date.now() / 1000) + seconds
}

async function findExistingDemoAuction() {
  const res = await fetch(`${API_BASE}/auction/by-auctioneer/${DEMO_AUCTIONEER}`)
  const body = await res.json() as any
  return (body.auctions ?? []).find((a: any) => a.title === DEMO_TITLE && a.status === 'active') ?? null
}

async function seedDemoNft() {
  const res = await fetch(`${API_BASE}/nft/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner: DEMO_OWNER,
      chainId: CHAIN_ID,
      metadata: DEMO_TRAITS,
      tokenId: DEMO_TOKEN_ID,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to seed demo NFT: ${res.status} ${await res.text()}`)
  }
  return await res.json() as { id: string; tokenId: string }
}

async function createDemoAuction(nftId: string) {
  const res = await fetch(`${API_BASE}/auction/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(DEMO_AUCTIONEER) },
    body: JSON.stringify({
      title: DEMO_TITLE,
      description: 'Fixed demo fixture for testing the standing buy order UI - see scripts/seed-standing-bid-demo.ts',
      nftContract: '0x0000000000000000000000000000000000000000',
      nftTokenId: DEMO_TOKEN_ID,
      chainId: CHAIN_ID,
      tokenContract: '0x0000000000000000000000000000000000000000',
      startingBid: '1000000000000000000', // 1 SCRIP-equivalent - low enough that any reasonable standing bid clears it
      endTime: futureUnix(30 * 24 * 3600), // 30 days out, won't expire mid-session
      auctioneer: DEMO_AUCTIONEER,
      salt: '0x' + '77'.repeat(4),
      signature: '0x' + '88'.repeat(65), // placeholder - this fixture is DB-only, never settled on-chain
      nftPermit: {
        owner: DEMO_AUCTIONEER,
        spender: '0x' + '99'.repeat(20),
        tokenId: DEMO_TOKEN_ID,
        amount: '1',
        deadline: String(futureUnix(30 * 24 * 3600)),
        salt: '0x' + 'aa'.repeat(4),
      },
      nftPermitSignature: '0x' + 'bb'.repeat(65),
      nftId,
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to create demo auction: ${res.status} ${await res.text()}`)
  }
  return await res.json() as any
}

async function main() {
  const existing = await findExistingDemoAuction()
  if (existing) {
    console.log('Demo auction already active, reusing it:')
    console.log(`  auctionId: ${existing.id}`)
  } else {
    const nft = await seedDemoNft()
    const created = await createDemoAuction(nft.id)
    console.log('Seeded demo NFT + auction:')
    console.log(`  auctionId: ${created.auction.id}`)
    console.log(`  nftId: ${nft.id}`)
  }

  console.log(`\nIn the Standing Buy Order form, select these exact traits for a guaranteed ${MINHASH_BANDS}/${MINHASH_BANDS} match:`)
  for (const [key, value] of Object.entries(DEMO_TRAITS)) {
    console.log(`  ${key}: ${value}`)
  }
  console.log('\nThen open the "🌱 Standing Bid Demo Auction" card in the bazaar - joining its room')
  console.log('re-checks standing bids after 500ms and should auto-attach yours.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
