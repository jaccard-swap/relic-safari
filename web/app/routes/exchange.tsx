import type { Route } from "./+types/exchange";
import { ExchangePage } from "../exchange/exchange-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Exchange" }];
}

export default function ExchangeRoute() {
  return <ExchangePage />;
}
