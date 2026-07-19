import type { Route } from "./+types/help";
import { HelpPage } from "../help/help-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Help" }];
}

export default function HelpRoute() {
  return <HelpPage />;
}
