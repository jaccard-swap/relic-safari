import type { Route } from "./+types/home";
import { VaultPage } from "../vault/vault-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Vault" }];
}

export default function HomeRoute() {
  return <VaultPage />;
}
