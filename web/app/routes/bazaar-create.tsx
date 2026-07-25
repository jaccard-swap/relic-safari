import type { Route } from "./+types/bazaar-create";
import { CreateAuctionPage } from "../bazaar/create-auction-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — List Artifact" }];
}

export default function BazaarCreateRoute() {
  return <CreateAuctionPage />;
}
