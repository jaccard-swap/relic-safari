import { createRoute } from '@tanstack/react-router'
import { Auction } from './Auction'

import type { RootRoute } from '@tanstack/react-router'

export default (parentRoute: RootRoute) =>
  createRoute({
    path: '/auction/$auctionId',
    component: Auction,
    getParentRoute: () => parentRoute,
  })

