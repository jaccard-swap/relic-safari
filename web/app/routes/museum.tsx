import type { Route } from "./+types/museum";
import { MuseumPage } from "../museum/museum-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Museum" }];
}

export default function MuseumRoute() {
  return <MuseumPage />;
}
