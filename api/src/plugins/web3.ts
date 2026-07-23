import { readFileSync } from 'node:fs'
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createPublicClient, createWalletClient, http } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { sepolia, hardhat } from 'viem/chains'

export type SupportedChainId = 11155111 | 31337

export type ContractArtifact = {
  address: `0x${string}`
  abi: readonly unknown[]
}

// hardhat/deploy overwrites these JSON files in place whenever contracts are
// (re)deployed, including after this process has already booted - a static
// `import` would bake in whatever address existed at module-load time and
// never see a later redeploy. Resolving the path once (cheap, and stable for
// the process lifetime) but re-reading the file contents on every call keeps
// this correct across both the initial deploy-vs-boot race and any
// mid-session redeploy, without requiring an api restart either way.
const artifactPaths: Record<SupportedChainId, string> = {
  11155111: require.resolve('@shared/contracts/11155111/JaccardERC1155.json'),
  31337: require.resolve('@shared/contracts/31337/JaccardERC1155.json')
}

function loadJaccardNftArtifact(chainId: SupportedChainId): ContractArtifact | undefined {
  // chainId is often just a cast of unvalidated request input (see callers),
  // so an unsupported value must fall through to undefined here rather than
  // throw - callers rely on this to produce a clean 400 instead of a 500.
  const filePath = artifactPaths[chainId]
  if (!filePath) return undefined

  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as {
    address: `0x${string}`
    abi: readonly unknown[]
  }
  return { address: data.address, abi: data.abi }
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

  fastify.decorate('publicClients', publicClients as any)
  fastify.decorate('walletClients', walletClients as any)
  fastify.decorate('getJaccardNft', loadJaccardNftArtifact)

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
    getJaccardNft: (chainId: SupportedChainId) => ContractArtifact | undefined
  }
}
