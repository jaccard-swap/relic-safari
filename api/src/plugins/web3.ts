import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createPublicClient, createWalletClient, http } from 'viem'
import { mnemonicToAccount, HDAccount } from 'viem/accounts'
import { baseSepolia, sepolia } from 'viem/chains'

import BaseSepoliaArtifact from '../artifacts/84532/JaccardERC1155.json'
import SepoliaArtifact from '../artifacts/11155111/JaccardERC1155.json'

export type SupportedChainId = 84532 | 11155111

export type ContractArtifact = {
  address: `0x${string}`
  abi: readonly unknown[]
}

export default fp(async (fastify: FastifyInstance) => {
  const mnemonic = process.env.MNEMONIC
  const account = mnemonic ? mnemonicToAccount(mnemonic, { accountIndex: 0 }) : null

  const publicClients = {
    84532: createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL)
    }),
    11155111: createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL)
    })
  } as const

  const walletClients = account ? {
    84532: createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL)
    }),
    11155111: createWalletClient({
      account,
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL)
    })
  } as const : null

  const jaccardNft = {
    84532: { address: BaseSepoliaArtifact.address as `0x${string}`, abi: BaseSepoliaArtifact.abi },
    11155111: { address: SepoliaArtifact.address as `0x${string}`, abi: SepoliaArtifact.abi }
  } as const

  fastify.decorate('web3Account', account)
  fastify.decorate('publicClients', publicClients as any)
  fastify.decorate('walletClients', walletClients as any)
  fastify.decorate('jaccardNft', jaccardNft)

  if (!walletClients) {
    fastify.log.warn('MNEMONIC not configured - sponsored transactions disabled')
  }
})

// Type declarations - using any for viem clients since the types are complex
declare module 'fastify' {
  interface FastifyInstance {
    web3Account: HDAccount | null
    publicClients: {
      84532: ReturnType<typeof createPublicClient>
      11155111: ReturnType<typeof createPublicClient>
    }
    walletClients: {
      84532: ReturnType<typeof createWalletClient>
      11155111: ReturnType<typeof createWalletClient>
    } | null
    jaccardNft: {
      84532: ContractArtifact
      11155111: ContractArtifact
    }
  }
}
