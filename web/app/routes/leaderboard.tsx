import type { Route } from "./+types/leaderboard";
import { LeaderboardPage } from "../leaderboard/leaderboard-page";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Relic Safari — Leaderboard" }];
}

export default function LeaderboardRoute() {
  return <LeaderboardPage />;
}
