import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiJson } from "../lib/api";
import { useAuthGate } from "../auth/use-auth-gate";

interface DigStatus {
  count: number;
  max: number;
  windowMs: number;
  nextAvailableAt: string | null;
  bypassed: boolean;
}

// Mirrors use-faucet-eligibility.ts's approach for the Scrip cooldown, but
// the dig limit is a rolling 5-per-24h window rather than a single
// per-address timestamp, so "am I eligible" isn't derivable from a single
// on-chain read - it comes from GET /faucet/status, which runs the exact
// same query the mint route itself rate-limits against.
export function useDigEligibility() {
  const { address, isConnected } = useAccount();
  const authenticated = useAuthGate();
  const [now, setNow] = useState(() => Date.now());
  const wasEligible = useRef(true);

  // /faucet/status is JWT-gated (it reads the rate-limit window off the
  // session's own address, not a client-supplied one) - waiting on
  // `authenticated` too avoids firing a request that's guaranteed to 401 in
  // the gap between wallet-connect and SIWE sign-in. `eligible` below
  // already defaults to true with no data, and the Dig button itself is
  // separately gated on `authenticated`, so there's nothing to show here
  // pre-sign-in anyway.
  const { data, refetch } = useQuery({
    queryKey: ["dig-status", address],
    queryFn: () => apiJson<DigStatus>("/faucet/status"),
    enabled: isConnected && authenticated,
    // Catches the rolling window advancing (a slot freeing up) even with no
    // local dig activity to trigger a refetch off of.
    refetchInterval: 30_000,
  });

  const nextAvailableAtMs = data?.nextAvailableAt ? new Date(data.nextAvailableAt).getTime() : null;
  const msRemaining = nextAvailableAtMs ? Math.max(0, nextAvailableAtMs - now) : 0;
  const eligible = !data || data.bypassed || msRemaining <= 0;

  useEffect(() => {
    if (eligible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [eligible]);

  useEffect(() => {
    // The local countdown hitting zero only means the oldest slot *should*
    // have freed up - refetch to confirm and pick up the next slot's count.
    if (eligible && !wasEligible.current) void refetch();
    wasEligible.current = eligible;
  }, [eligible, refetch]);

  return {
    count: data?.count ?? 0,
    max: data?.max ?? 5,
    bypassed: data?.bypassed ?? false,
    eligible,
    msRemaining,
    refetchDigStatus: refetch,
  };
}
