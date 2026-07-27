import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("bazaar", "routes/bazaar.tsx"),
    route("bazaar/create/:nftId", "routes/bazaar-create.tsx"),
    route("excavation", "routes/excavation.tsx"),
    route("forge", "routes/forge.tsx"),
    route("exchange", "routes/exchange.tsx"),
    route("museum", "routes/museum.tsx"),
    route("leaderboard", "routes/leaderboard.tsx"),
    route("auction/:auctionId", "routes/auction.tsx"),
    route("help", "routes/help.tsx"),
  ]),
] satisfies RouteConfig;
