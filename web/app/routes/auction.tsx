import type { Route } from "./+types/auction";
import { AuctionRoomPage } from "../auction/auction-room-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Auction" }];
}

export default function AuctionRoute() {
  return <AuctionRoomPage />;
}
