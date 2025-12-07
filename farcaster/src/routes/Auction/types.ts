// EIP-712 types for bidding

export const ERC20PermitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const ERC20PermitDataTypes = {
  ERC20PermitData: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export const BidTypes = {
  Bid: [
    { name: 'salt', type: 'bytes4' },
    { name: 'deadline', type: 'uint256' },
    { name: 'targetMinHash', type: 'bytes32[5]' },
    { name: 'minMatches', type: 'uint8' },
    { name: 'permit', type: 'ERC20PermitData' },
  ],
  ...ERC20PermitDataTypes,
} as const

