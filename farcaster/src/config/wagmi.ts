import { http, fallback, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { sepolia, baseSepolia } from 'wagmi/chains'
import {unstable_connector} from '@wagmi/core'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

const rpcUrl = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL!

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    miniAppConnector()
  ],
  transports: {
    [baseSepolia.id]: fallback([unstable_connector(injected), http(rpcUrl)]),
  },
})



