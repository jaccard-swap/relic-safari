import { useSignTypedData, useChainId, useConnection } from 'wagmi'
import { useStaticData } from './useStaticData'
import {
  BidTypes,
  AuctionTypes,
  JaccardERC1155PermitTypes,
  ERC20PermitTypes,
  EIP712_DOMAINS,
} from '@shared/constants'

// Re-export for consumers
export { BidTypes, AuctionTypes, JaccardERC1155PermitTypes, ERC20PermitTypes }

// Message interfaces

export interface ERC20PermitDataMessage {
  owner: `0x${string}`
  spender: `0x${string}`
  value: bigint
  deadline: bigint
  // These are added after signing the ERC20 permit
  v?: number
  r?: `0x${string}`
  s?: `0x${string}`
}

export interface BidMessage {
  salt: `0x${string}`
  deadline: bigint
  targetMinHash: [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`]
  minMatches: number
  permit: ERC20PermitDataMessage
}

export interface JaccardERC1155PermitMessage {
  owner: `0x${string}`
  spender: `0x${string}`
  tokenId: bigint
  amount: bigint
  deadline: bigint
  salt: `0x${string}`
}

export interface AuctionMessage {
  salt: `0x${string}`
  deadline: bigint
  nft: `0x${string}`
  token: `0x${string}`
  reservePrice: bigint
  nftPermit: JaccardERC1155PermitMessage
  nftPermitSignature: `0x${string}`
}

export interface FullAuctionMessage extends AuctionMessage {
  bids: BidMessage[]
  bidSignatures: `0x${string}`[]
}

// Helper to split signature into v, r, s
export function splitSignature(sig: `0x${string}`) {
  const sigNoPrefix = sig.slice(2)
  const r = ('0x' + sigNoPrefix.slice(0, 64)) as `0x${string}`
  const s = ('0x' + sigNoPrefix.slice(64, 128)) as `0x${string}`
  const v = parseInt(sigNoPrefix.slice(128, 130), 16)
  return { v, r, s }
}

export const useAuctionSignature = () => {
  const chainId = useChainId()
  const { address } = useConnection()
  const { staticData } = useStaticData()
  const { signTypedData, isPending, error } = useSignTypedData()

  // Domain for JaccardSwap contract
  const auctionDomain = {
    name: EIP712_DOMAINS.JACCARD_SWAP,
    version: '1',
    chainId,
    verifyingContract: staticData?.jaccardSwapAddr as `0x${string}`,
  }

  // Domain for JaccardERC1155 NFT contract
  const nftDomain = {
    name: EIP712_DOMAINS.JACCARD_ERC1155,
    version: '1',
    chainId,
    verifyingContract: staticData?.jaccardErc1155Addr as `0x${string}`,
  }

  // Domain for ERC20 token (MockERC20)
  const tokenDomain = {
    name: EIP712_DOMAINS.MOCK_ERC20,
    version: '1',
    chainId,
    verifyingContract: staticData?.mockErc20Addr as `0x${string}`,
  }

  // Sign NFT permit (JaccardERC1155Permit)
  const signNftPermit = (message: JaccardERC1155PermitMessage): Promise<`0x${string}`> => {
    return new Promise((resolve, reject) => {
      signTypedData(
        {
          domain: nftDomain,
          types: JaccardERC1155PermitTypes,
          primaryType: 'JaccardERC1155Permit',
          message,
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      )
    })
  }

  // Sign ERC20 permit (for token transfer approval)
  const signErc20Permit = (message: {
    owner: `0x${string}`
    spender: `0x${string}`
    value: bigint
    nonce: bigint
    deadline: bigint
  }): Promise<`0x${string}`> => {
    return new Promise((resolve, reject) => {
      signTypedData(
        {
          domain: tokenDomain,
          types: ERC20PermitTypes,
          primaryType: 'Permit',
          message,
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      )
    })
  }

  // Sign a bid
  const signBid = (message: BidMessage): Promise<`0x${string}`> => {
    return new Promise((resolve, reject) => {
      signTypedData(
        {
          domain: auctionDomain,
          types: BidTypes,
          primaryType: 'Bid',
          message,
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      )
    })
  }

  // Sign an auction (for creation)
  const signAuction = (message: AuctionMessage): Promise<`0x${string}`> => {
    return new Promise((resolve, reject) => {
      signTypedData(
        {
          domain: auctionDomain,
          types: AuctionTypes,
          primaryType: 'Auction',
          message,
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      )
    })
  }

  return {
    signNftPermit,
    signErc20Permit,
    signBid,
    signAuction,
    splitSignature,
    isPending,
    error,
    auctionDomain,
    nftDomain,
    tokenDomain,
    address,
    staticData,
  }
}

