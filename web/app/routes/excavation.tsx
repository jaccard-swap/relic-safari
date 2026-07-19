import type { Route } from "./+types/excavation";
import { ExcavationPage } from "../excavation/excavation-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Excavation" }];
}

export default function ExcavationRoute() {
  return <ExcavationPage />;
}
