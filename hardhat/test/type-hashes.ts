
export const EIP712DOMAIN = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
]

export const Auction = [
  { name: 'auctioneer', type:'address' },
  { name: 'auctioneerNonce', type:'uint256' },
  { name: 'nft', type:'address' },
  { name: 'nftId', type:'uint256' },
  { name: 'token', type:'address' },
  { name: 'bidStart', type:'uint256' },
  { name: 'deadline', type:'uint256' },
  { name: 'auctionSigHash', type:'bytes32' },
  { name: 'bids', type:'Bid[]' },
  { name: 'bidSigs', type:'bytes[]' },
]
export const AuctionAuthSig = [
  { name: 'auctioneer', type:'address' },
  { name: 'auctioneerNonce', type:'uint256' },
  { name: 'nft', type:'address' },
  { name: 'nftId', type:'uint256' },
  { name: 'token', type:'address' },
  { name: 'bidStart', type:'uint256' },
  { name: 'deadline', type:'uint256' },
]
export const Bid = [
  { name: 'bidder', type:'address' },
  { name: 'amount', type:'uint256' },
  { name: 'bidderNonce', type:'uint256' },
  { name: 'auctionSigHash', type:'bytes32' }
]

