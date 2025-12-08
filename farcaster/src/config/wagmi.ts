import { http, fallback, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { baseSepolia, base } from 'wagmi/chains'
import {unstable_connector} from '@wagmi/core'
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'

const baseSepoliaRpcUrl = import.meta.env.VITE_BASE_SEPOLIA_RPC_URL!
//const baseRpcUrl = import.meta.env.VITE_BASE_RPC_URL!

export const config = createConfig({
  chains: [baseSepolia, /*base*/],
  connectors: [
    injected(),
    miniAppConnector()
  ],
  transports: {
    [baseSepolia.id]: fallback([unstable_connector(injected), http(baseSepoliaRpcUrl)]),
    //[base.id]: fallback([unstable_connector(injected), http(baseRpcUrl)]),
  },
})



