import type { Route } from "./+types/forge";
import { ForgePage } from "../forge/forge-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Forge" }];
}

export default function ForgeRoute() {
  return <ForgePage />;
}
