import { StrictMode, useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { WagmiProvider } from 'wagmi'
import { useConnection } from 'wagmi'
import { sdk } from '@farcaster/miniapp-sdk'
import { fetchNfts, clearNfts } from './stores/nftStore'

import { Navbar } from './components/Navbar'
import { Loading } from './components/Loading'
// import { BottomNav } from './components/BottomNav'

import { config } from './config/wagmi'
import * as TanStackQueryProvider from './integrations/tanstack-query/root-provider.tsx'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

import App from './App.tsx'
import { Bazaar } from './routes/Bazaar'
import { Excavation } from './routes/Excavation'
import createAuctionRoute from './routes/Auction'

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()

function RootComponent() {
  const { address, chainId } = useConnection()
  const [isReady, setIsReady] = useState(false)

  // Initialize NFT store on any route
  useEffect(() => {
    if (address) {
      fetchNfts(address, chainId)
    } else {
      clearNfts()
    }
  }, [address, chainId])

  useEffect(() => {
    const init = async () => {
      // In dev, add minimum delay so you can see the loading animation
      const minDelay = import.meta.env.DEV ? 2000 : 0
      const start = Date.now()

      try {
        await sdk.actions.ready()
        console.log('SDK ready')
      } catch (e) {
        console.log('SDK ready (non-frame context)', e)
      }

      // Wait remaining time if SDK was faster than minDelay
      const elapsed = Date.now() - start
      if (elapsed < minDelay) {
        await new Promise(r => setTimeout(r, minDelay - elapsed))
      }

      setIsReady(true)
    }
    init()
  }, [])

  if (!isReady) {
    return <Loading />
  }

  return (
    <div className="min-h-screen max-w-[393px] mx-auto bg-stone-900 relative">
      <Navbar />
      <Outlet />
      {/* <BottomNav /> */}
      <TanStackRouterDevtools />
    </div>
  )
}

const rootRoute = createRootRoute({
  component: RootComponent,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: App,
})

const bazaarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bazaar',
  component: Bazaar,
})

const excavationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/excavation',
  component: Excavation,
})

const auctionRoute = createAuctionRoute(rootRoute)

const routeTree = rootRoute.addChildren([
  indexRoute,
  bazaarRoute,
  excavationRoute,
  auctionRoute,
])

const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <WagmiProvider config={config}>
        <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
          <RouterProvider router={router} />
        </TanStackQueryProvider.Provider>
      </WagmiProvider>
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
