import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createPublicClient, createWalletClient, http } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { sepolia, hardhat } from 'viem/chains'

import SepoliaArtifact from '@shared/contracts/11155111/JaccardERC1155.json'
import LocalhostArtifact from '@shared/contracts/31337/JaccardERC1155.json'

export type SupportedChainId = 11155111 | 31337

export type ContractArtifact = {
  address: `0x${string}`
  abi: readonly unknown[]
}

export default fp(async (fastify: FastifyInstance) => {
  // Real chains sign with MNEMONIC (the funded deployer account); the local
  // anvil chain has its own throwaway funded account under MNEMONIC_LOCALHOST
  // (see hardhat.config.ts) - reusing MNEMONIC there would sign with an
  // address that has no balance on a fresh anvil chain.
  const mnemonic = process.env.MNEMONIC
  const account = mnemonic ? mnemonicToAccount(mnemonic, { accountIndex: 0 }) : null

  const localMnemonic = process.env.MNEMONIC_LOCALHOST
  const localAccount = localMnemonic ? mnemonicToAccount(localMnemonic, { accountIndex: 0 }) : null

  const publicClients = {
    11155111: createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL)
    }),
    31337: createPublicClient({
      chain: hardhat,
      transport: http(process.env.LOCALHOST_RPC_URL)
    })
  } as const

  // Each chain's wallet client is independently gated on its own account
  // being configured, rather than an all-or-nothing single account - a dev
  // box can easily have MNEMONIC_LOCALHOST (anvil) without a real MNEMONIC,
  // or vice versa in a deployed environment with no local chain at all.
  const walletClients: Partial<Record<SupportedChainId, ReturnType<typeof createWalletClient>>> = {}
  if (account) {
    walletClients[11155111] = createWalletClient({
      account,
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL)
    })
  }
  if (localAccount) {
    walletClients[31337] = createWalletClient({
      account: localAccount,
      chain: hardhat,
      transport: http(process.env.LOCALHOST_RPC_URL)
    })
  }

  const jaccardNft = {
    11155111: { address: SepoliaArtifact.address as `0x${string}`, abi: SepoliaArtifact.abi },
    31337: { address: LocalhostArtifact.address as `0x${string}`, abi: LocalhostArtifact.abi }
  } as const

  fastify.decorate('publicClients', publicClients as any)
  fastify.decorate('walletClients', walletClients as any)
  fastify.decorate('jaccardNft', jaccardNft)

  if (!account) {
    fastify.log.warn('MNEMONIC not configured - sponsored transactions on sepolia disabled')
  }
  if (!localAccount) {
    fastify.log.warn('MNEMONIC_LOCALHOST not configured - sponsored transactions on localhost disabled')
  }
})

// Type declarations - using any for viem clients since the types are complex
declare module 'fastify' {
  interface FastifyInstance {
    publicClients: {
      11155111: ReturnType<typeof createPublicClient>
      31337: ReturnType<typeof createPublicClient>
    }
    walletClients: Partial<Record<SupportedChainId, ReturnType<typeof createWalletClient>>>
    jaccardNft: {
      11155111: ContractArtifact
      31337: ContractArtifact
    }
  }
}
