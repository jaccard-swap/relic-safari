import type { Route } from "./+types/bazaar";
import { BazaarPage } from "../bazaar/bazaar-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Bazaar" }];
}

export default function BazaarRoute() {
  return <BazaarPage />;
}
