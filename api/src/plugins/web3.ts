import { readFileSync } from 'node:fs'
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createPublicClient, createWalletClient, http } from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
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
const jaccardNftArtifactPaths: Record<SupportedChainId, string> = {
  11155111: require.resolve('@shared/contracts/11155111/JaccardERC1155.json'),
  31337: require.resolve('@shared/contracts/31337/JaccardERC1155.json')
}

const essenceArtifactPaths: Record<SupportedChainId, string> = {
  11155111: require.resolve('@shared/contracts/11155111/Essence.json'),
  31337: require.resolve('@shared/contracts/31337/Essence.json')
}

function loadArtifact(paths: Record<SupportedChainId, string>, chainId: SupportedChainId): ContractArtifact | undefined {
  // chainId is often just a cast of unvalidated request input (see callers),
  // so an unsupported value must fall through to undefined here rather than
  // throw - callers rely on this to produce a clean 400 instead of a 500.
  const filePath = paths[chainId]
  if (!filePath) return undefined

  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as {
    address: `0x${string}`
    abi: readonly unknown[]
  }
  return { address: data.address, abi: data.abi }
}

function loadJaccardNftArtifact(chainId: SupportedChainId): ContractArtifact | undefined {
  return loadArtifact(jaccardNftArtifactPaths, chainId)
}

function loadEssenceArtifact(chainId: SupportedChainId): ContractArtifact | undefined {
  return loadArtifact(essenceArtifactPaths, chainId)
}

export default fp(async (fastify: FastifyInstance) => {
  const isProduction = process.env.NODE_ENV === 'production'

  // Each environment only ever builds the signer for its own chain -
  // production signs sepolia with the sponsor/relayer account
  // (SPONSOR_PRIVATE_KEY), everything else signs the local anvil chain with
  // its own throwaway funded account (MNEMONIC_LOCALHOST, see
  // hardhat.config.ts). Strictly gated on NODE_ENV rather than "whichever
  // credential happens to be set" - a stray SPONSOR_PRIVATE_KEY left in a
  // dev .env, or MNEMONIC_LOCALHOST leaking into .env.production, must not
  // let either environment sign against the other's chain.
  const account = isProduction && process.env.SPONSOR_PRIVATE_KEY
    ? privateKeyToAccount(process.env.SPONSOR_PRIVATE_KEY as `0x${string}`)
    : null

  const localAccount = !isProduction && process.env.MNEMONIC_LOCALHOST
    ? mnemonicToAccount(process.env.MNEMONIC_LOCALHOST, { accountIndex: 0 })
    : null

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

  // account and localAccount are mutually exclusive (see isProduction gate
  // above), so at most one of these ever populates in a given process.
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
  fastify.decorate('getEssence', loadEssenceArtifact)

  if (isProduction && !account) {
    fastify.log.warn('SPONSOR_PRIVATE_KEY not configured - sponsored transactions on sepolia disabled')
  }
  if (!isProduction && !localAccount) {
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
    getEssence: (chainId: SupportedChainId) => ContractArtifact | undefined
  }
}
