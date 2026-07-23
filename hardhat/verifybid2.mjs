import { encodeFunctionData, decodeFunctionResult } from 'viem'
import { readFileSync } from 'node:fs'

const artifact = JSON.parse(readFileSync('artifacts/contracts/diamond/facets/JaccardSwapFacet.sol/JaccardSwapFacet.json', 'utf-8'))
const calldata = readFileSync('/tmp/claude-1000/-home-thdev-code-ah-p2p/4b928992-2949-4e14-9cc9-f7d0afc69c26/scratchpad/calldata2.txt', 'utf-8').trim()

// re-decode to get the exact bid struct + bidSignature
import { decodeFunctionData } from 'viem'
const decoded = decodeFunctionData({ abi: artifact.abi, data: calldata })
const auction = decoded.args[0]
const bid = auction.bids[0]
const bidSig = auction.bidSignatures[0]

const callData = encodeFunctionData({
  abi: artifact.abi,
  functionName: 'verifyBid',
  args: [bid, bidSig],
})
console.log(callData)
