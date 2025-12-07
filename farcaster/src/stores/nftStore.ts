import { Store, Derived } from '@tanstack/store'

export interface NftMetadata {
  name: string
  type?: string
  rarity?: string
  mood?: string
  origin?: string
  power?: string
  generation?: number
  year?: number
  [key: string]: string | number | undefined
}

export interface Nft {
  id: string
  tokenId: string
  chainId: number
  contractAddress: string
  metadata: NftMetadata
  minHash: string[]
  txHash: string
  createdAt: string
  status?: string
}

interface NftStoreState {
  nfts: Nft[]
  loading: boolean
  error: string | null
  address: string | null
  chainId: number | null
}

export const nftStore = new Store<NftStoreState>({
  nfts: [],
  loading: false,
  error: null,
  address: null,
  chainId: null,
})

// Derived: only active (non-consumed) NFTs
export const activeNfts = new Derived({
  fn: () => nftStore.state.nfts.filter(n => n.status !== 'consumed'),
  deps: [nftStore],
})
activeNfts.mount()

// Actions
export const fetchNfts = async (address: string, chainId?: number) => {
  nftStore.setState(s => ({ ...s, loading: true, error: null, address, chainId: chainId ?? null }))
  
  try {
    const params = chainId ? `?chainId=${chainId}` : ''
    const response = await fetch(`/api/nft/by-owner/${address}${params}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch NFTs')
    }

    const data = await response.json()
    nftStore.setState(s => ({ ...s, nfts: data.nfts || [], loading: false }))
  } catch (err) {
    nftStore.setState(s => ({ ...s, error: (err as Error).message, nfts: [], loading: false }))
  }
}

export const invalidateNfts = () => {
  const { address, chainId } = nftStore.state
  if (address) {
    fetchNfts(address, chainId ?? undefined)
  }
}

export const clearNfts = () => {
  nftStore.setState(() => ({
    nfts: [],
    loading: false,
    error: null,
    address: null,
    chainId: null,
  }))
}

